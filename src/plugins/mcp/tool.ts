import { z } from 'zod/v3'

import { isAdminUser } from '@/access'

import { describeError } from './errors'
import type { AdminToolSpec, ToolResult } from './types'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'

type PluginTool = NonNullable<NonNullable<MCPPluginConfig['mcp']>['tools']>[number]

export const NOT_ADMIN =
  'Access denied. The CILAS account behind this connection is not an administrator any more. Ask a current administrator to connect the assistant again.'

const text = (value: unknown): ToolResult => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
})

export const succeed = (value: unknown): ToolResult => text(value)
export const fail = (message: string): ToolResult => ({ ...text(message), isError: true })

/**
 * Builds a plugin tool that refuses anyone but a current admin. The plugin
 * loads the account behind a connection or key on every request, so a demoted
 * account loses access at once, even though the connection is still valid.
 *
 * The tools use zod's v3 API (`zod/v3`), as the plugin does. A zod 4 schema
 * keeps `.describe()` text in a registry that the MCP SDK's own copy of zod
 * cannot see, so the AI client would lose every parameter description.
 */
export const adminTool = <Shape extends z.ZodRawShape>(spec: AdminToolSpec<Shape>): PluginTool => ({
  name: spec.name,
  description: spec.description,
  parameters: spec.shape as unknown as PluginTool['parameters'],
  handler: async (rawInput, req) => {
    if (!req.user || !isAdminUser(req.user)) return fail(NOT_ADMIN)
    const failedInput = (message: string) =>
      spec.name.endsWith('_draft')
        ? {
            ...succeed({
              completeness: 'incomplete',
              message,
              fields: {
                saved: [],
                not_saved: [{ field: 'input', reason: message }],
                needs_human_review: [],
              },
            }),
            isError: true,
          }
        : fail(message)
    const parsed = z.object(spec.shape).strict().safeParse(rawInput)
    if (!parsed.success) {
      return failedInput(
        `Invalid input: ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
          .join('; ')}`,
      )
    }
    try {
      return succeed(await spec.run(parsed.data, { req, payload: req.payload, user: req.user }))
    } catch (error) {
      req.payload.logger.error({ err: error, msg: `MCP tool ${spec.name} failed` })
      return failedInput(describeError(error))
    }
  },
})
