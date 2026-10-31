// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import * as z from 'zod'
import { describe, expect, it } from 'vitest'

import { isCurrent, recordAnswer, AGENT_MODEL } from '../../migration/lib/agent-extract'

const Schema = z.object({ n: z.number() })

describe('agent extraction cache', () => {
  it('records a valid answer stamped with the prompt hash, and sees it as current', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-'))
    const answer = path.join(dir, 'a.json')
    writeFileSync(answer, JSON.stringify({ n: 3 }))
    recordAnswer({
      outDir: dir,
      name: 'page.html',
      prompt: 'P',
      version: '1',
      schema: Schema,
      answerFile: answer,
    })
    const saved = JSON.parse(readFileSync(path.join(dir, 'page.html.json'), 'utf8'))
    expect(saved).toMatchObject({ model: AGENT_MODEL, version: '1', data: { n: 3 } })
    expect(isCurrent({ outDir: dir, name: 'page.html', prompt: 'P', version: '1' })).toBe(true)
    expect(isCurrent({ outDir: dir, name: 'page.html', prompt: 'changed', version: '1' })).toBe(
      false,
    )
  })

  it('refuses an answer that does not match the schema', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'agent-'))
    const answer = path.join(dir, 'a.json')
    writeFileSync(answer, JSON.stringify({ n: 'x' }))
    expect(() =>
      recordAnswer({
        outDir: dir,
        name: 'p',
        prompt: 'P',
        version: '1',
        schema: Schema,
        answerFile: answer,
      }),
    ).toThrow()
  })
})
