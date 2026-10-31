// @vitest-environment node
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as z from 'zod'
import { describe, expect, it, vi } from 'vitest'

import { extractCached } from '../../migration/lib/llm'

const Schema = z.object({ answer: z.number() })

describe('extractCached', () => {
  it('calls the model once, then reads the cache while the input is unchanged', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const call = vi.fn().mockResolvedValue({ answer: 42 })
    const args = {
      dir,
      name: 'page.html',
      prompt: 'P',
      version: '1',
      model: 'm',
      schema: Schema,
      call,
    }

    expect(await extractCached(args)).toEqual({ answer: 42 })
    expect(await extractCached(args)).toEqual({ answer: 42 })
    expect(call).toHaveBeenCalledTimes(1)
    expect(JSON.parse(readFileSync(path.join(dir, 'page.html.json'), 'utf8'))).toMatchObject({
      model: 'm',
      data: { answer: 42 },
    })
  })

  it('re-runs when the prompt changes', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const call = vi.fn().mockResolvedValue({ answer: 1 })
    await extractCached({
      dir,
      name: 'p',
      prompt: 'A',
      version: '1',
      model: 'm',
      schema: Schema,
      call,
    })
    await extractCached({
      dir,
      name: 'p',
      prompt: 'B',
      version: '1',
      model: 'm',
      schema: Schema,
      call,
    })
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('rejects output that does not match the schema, and caches nothing', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const call = vi.fn().mockResolvedValue({ answer: 'no' })
    await expect(
      extractCached({
        dir,
        name: 'p',
        prompt: 'A',
        version: '1',
        model: 'm',
        schema: Schema,
        call,
      }),
    ).rejects.toThrow()
    await expect(
      extractCached({
        dir,
        name: 'p',
        prompt: 'A',
        version: '1',
        model: 'm',
        schema: Schema,
        call,
      }),
    ).rejects.toThrow()
    expect(call).toHaveBeenCalledTimes(2)
  })
})
