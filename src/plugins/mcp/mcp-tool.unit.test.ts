// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { z } from 'zod/v3'
import { adminTool, NOT_ADMIN } from '@/plugins/mcp/tool'
import { draftInputError } from '@/plugins/mcp/draft-result'
import type { ToolResult } from '@/plugins/mcp/types'

const setup = (roles = ['admin']) => {
  const run = vi.fn(async ({ count }: { count: number }) => ({ saved: count }))
  const tool = adminTool({
    name: 'renamed_content_writer',
    description: 'Write content',
    shape: { count: z.number().int().positive() },
    inputError: draftInputError,
    run,
  })
  const req = {
    user: { id: 1, collection: 'users', roles },
    payload: { logger: { error: vi.fn() } },
  } as unknown as PayloadRequest
  const call = async (input: Record<string, unknown>) =>
    (await tool.handler(input, req, {})) as ToolResult
  return { run, call, req }
}

describe('MCP tool boundary', () => {
  it('checks the current administrator before running or validating input', async () => {
    const { run, call, req } = setup()
    expect((await call({ count: 1 })).isError).not.toBe(true)
    req.user!.roles = ['member']
    const denied = await call({ count: 'invalid' })
    expect(denied.isError).toBe(true)
    expect(denied.content[0]?.text).toBe(NOT_ADMIN)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it.each([{ count: -1 }, { count: '1' }, { count: 1, publish: true }])(
    'rejects invalid input before executing: %j',
    async (input) => {
      const { call, run } = setup()
      const result = await call(input)
      expect(result.isError).toBe(true)
      expect(JSON.parse(result.content[0]!.text)).toMatchObject({
        completeness: 'incomplete',
        fields: { saved: [], not_saved: [{ field: 'input' }] },
      })
      expect(run).not.toHaveBeenCalled()
    },
  )

  it('keeps draft failure reporting after a tool rename and hides unexpected errors', async () => {
    const { call, run } = setup()
    run.mockRejectedValueOnce(new Error('private database details'))
    const result = await call({ count: 1 })
    expect(result.isError).toBe(true)
    const body = JSON.parse(result.content[0]!.text)
    expect(body.completeness).toBe('incomplete')
    expect(body.fields.saved).toEqual([])
    expect(body.message).not.toContain('private database details')
  })
})
