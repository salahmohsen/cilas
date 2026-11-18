import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as z from 'zod'
import { describe, expect, it } from 'vitest'

import { extractCached } from './llm'

const Schema = z.object({ answer: z.number() })

const answering = (answer: unknown) => {
  let calls = 0
  return {
    call: async () => {
      calls++
      return answer
    },
    calls: () => calls,
  }
}

describe('extractCached', () => {
  it('calls the model once, then reads the cache while the input is unchanged', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const model = answering({ answer: 42 })
    const args = {
      dir,
      name: 'page.html',
      prompt: 'P',
      version: '1',
      model: 'm',
      schema: Schema,
      call: model.call,
    }

    expect(await extractCached(args)).toEqual({ answer: 42 })
    expect(await extractCached(args)).toEqual({ answer: 42 })
    expect(model.calls()).toBe(1)
    expect(JSON.parse(readFileSync(path.join(dir, 'page.html.json'), 'utf8'))).toMatchObject({
      model: 'm',
      data: { answer: 42 },
    })
  })

  it('re-runs when the prompt changes', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const model = answering({ answer: 1 })
    await extractCached({
      dir,
      name: 'p',
      prompt: 'A',
      version: '1',
      model: 'm',
      schema: Schema,
      call: model.call,
    })
    await extractCached({
      dir,
      name: 'p',
      prompt: 'B',
      version: '1',
      model: 'm',
      schema: Schema,
      call: model.call,
    })
    expect(model.calls()).toBe(2)
  })

  it('rejects output that does not match the schema, and caches nothing', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'extract-'))
    const model = answering({ answer: 'no' })
    await expect(
      extractCached({
        dir,
        name: 'p',
        prompt: 'A',
        version: '1',
        model: 'm',
        schema: Schema,
        call: model.call,
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
        call: model.call,
      }),
    ).rejects.toThrow()
    expect(model.calls()).toBe(2)
  })
})
