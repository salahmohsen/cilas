/**
 * Stage 2: each cycle, course and lab page → migration/extracted/<file>.json.
 * Unchanged pages are skipped (content hash), so re-runs only redo what changed.
 *
 * With a Claude Code subscription (no API key), an agent works page by page:
 *   npx tsx migration/extract-courses.ts migration/raw --pending
 *   npx tsx migration/extract-courses.ts migration/raw --prompt <file>
 *   npx tsx migration/extract-courses.ts migration/raw --record <file> <answer.json>
 * `--record` validates the answer against the schema before caching it.
 *   npx tsx migration/extract-courses.ts migration/raw --restamp-monolingual
 * re-certifies existing answers for single-language pages after a prompt
 * change that only affects bilingual pages; bilingual ones stay pending.
 *
 * With ANTHROPIC_API_KEY set, it can instead call the API for every page:
 *   npx tsx --env-file=.env migration/extract-courses.ts migration/raw --api [--only a.html,b.html]
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import * as z from 'zod'

import { CoursePage, PROMPT_VERSION, coursePrompt } from './lib/extraction-schema'
import { EXTRACT_MODEL, anthropicCall, extractCached } from './lib/llm'
import { pageText } from './lib/page-text'

/** Recorded on answers written by a Claude Code agent rather than the API. */
const AGENT_MODEL = 'claude-code:haiku'

const [raw, mode, ...rest] = process.argv.slice(2)
if (!raw || !mode) {
  throw new Error('Usage: extract-courses.ts <raw dir> --pending | --prompt <file> | --record <file> <answer.json> | --api [--only a,b]')
}

type ManifestPage = { file: string; source: 'zip' | 'mirror'; kind: string; title: string }
const here = import.meta.dirname
const outDir = path.join(here, 'extracted')
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: ManifestPage[]
}
const todo = pages.filter((p) => ['cycle', 'course', 'lab'].includes(p.kind))

const dirOf = (source: ManifestPage['source']) =>
  source === 'zip' ? path.join(raw, 'weebly-zip-2025-04-23') : path.join(raw, 'mirror', 'pages')

const promptFor = (page: ManifestPage): string =>
  coursePrompt({
    file: page.file,
    kind: page.kind,
    title: page.title,
    text: pageText(readFileSync(path.join(dirOf(page.source), page.file), 'utf8')),
  })

const pageNamed = (file: string): ManifestPage => {
  const page = todo.find((p) => p.file === file)
  if (!page) throw new Error(`${file} is not a cycle, course or lab page in the manifest`)
  return page
}

const shaOf = (model: string, prompt: string) =>
  createHash('sha256').update(`${PROMPT_VERSION}\n${model}\n${prompt}`).digest('hex')

/** Cached under either model, and still matching the current page text and prompt. */
const isCurrent = (page: ManifestPage): boolean => {
  const file = path.join(outDir, `${page.file}.json`)
  if (!existsSync(file)) return false
  const cached = JSON.parse(readFileSync(file, 'utf8')) as { sha256: string; model: string }
  return cached.sha256 === shaOf(cached.model, promptFor(page))
}

const main = async () => {
  if (mode === '--pending') {
    const pending = todo.filter((p) => !isCurrent(p))
    for (const p of pending) console.log(p.file)
    console.error(`${pending.length} of ${todo.length} page(s) pending`)
    return
  }

  if (mode === '--prompt') {
    const page = pageNamed(rest[0])
    const { $schema: _draft, ...schema } = z.toJSONSchema(CoursePage) as Record<string, unknown>
    console.log(promptFor(page).replace(/\n\nCall the record_page tool with the result\.$/, ''))
    console.log('\nAnswer with one JSON object matching this JSON Schema, and nothing else:\n')
    console.log(JSON.stringify(schema))
    return
  }

  if (mode === '--record') {
    const page = pageNamed(rest[0])
    const answer = JSON.parse(readFileSync(rest[1], 'utf8')) as unknown
    const data = CoursePage.parse(answer) // throws with the exact field on a bad answer
    const prompt = promptFor(page)
    mkdirSync(outDir, { recursive: true })
    writeFileSync(
      path.join(outDir, `${page.file}.json`),
      `${JSON.stringify({ sha256: shaOf(AGENT_MODEL, prompt), model: AGENT_MODEL, version: PROMPT_VERSION, data }, null, 2)}\n`,
    )
    const n = data.course ? 1 : data.cycles.reduce((s, c) => s + c.courses.length, 0)
    console.log(`${page.file}: recorded, ${n} course(s)`)
    return
  }

  if (mode === '--restamp-monolingual') {
    // Both scripts in quantity means a bilingual page.
    const bilingual = (text: string) => {
      const letters = text.match(/\p{L}/gu) ?? []
      const arabic = letters.filter((c) => /\p{Script=Arabic}/u.test(c)).length
      const share = letters.length ? arabic / letters.length : 0
      return share > 0.15 && share < 0.85
    }
    let restamped = 0
    for (const page of todo) {
      const file = path.join(outDir, `${page.file}.json`)
      if (!existsSync(file) || isCurrent(page)) continue
      const prompt = promptFor(page)
      if (bilingual(prompt)) continue
      const cached = JSON.parse(readFileSync(file, 'utf8')) as { model: string; data: unknown }
      const data = CoursePage.parse(cached.data)
      writeFileSync(
        file,
        `${JSON.stringify({ sha256: shaOf(cached.model, prompt), model: cached.model, version: PROMPT_VERSION, data }, null, 2)}\n`,
      )
      restamped++
    }
    console.log(`restamped ${restamped} single-language page(s)`)
    return
  }

  if (mode === '--api') {
    const only = rest[0] === '--only' ? new Set(rest[1].split(',')) : null
    const call = anthropicCall(CoursePage)
    let failed = 0
    const batch = todo.filter((p) => !only || only.has(p.file))
    // Three at a time keeps well under rate limits.
    for (let i = 0; i < batch.length; i += 3) {
      await Promise.all(
        batch.slice(i, i + 3).map(async (page) => {
          try {
            const data = await extractCached({
              dir: outDir,
              name: page.file,
              prompt: promptFor(page),
              version: PROMPT_VERSION,
              model: EXTRACT_MODEL,
              schema: CoursePage,
              call,
            })
            const n = data.course ? 1 : data.cycles.reduce((s, c) => s + c.courses.length, 0)
            console.log(`${page.file}: ${n} course(s)`)
          } catch (error) {
            failed++
            console.error(`${page.file}: FAILED ${(error as Error).message}`)
          }
        }),
      )
    }
    console.log(`${batch.length} page(s), ${failed} failed`)
    if (failed) process.exitCode = 1
    return
  }

  throw new Error(`Unknown mode ${mode}`)
}

main()
