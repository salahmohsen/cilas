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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { agentPrompt, isCurrent as isCurrentAnswer, recordAnswer, shaOf } from './lib/agent-extract'
import { CoursePage, PROMPT_VERSION, coursePrompt } from './lib/extraction-schema'
import { EXTRACT_MODEL, anthropicCall, extractCached } from './lib/llm'
import { pageText } from './lib/page-text'

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

/** Cached under either model, and still matching the current page text and prompt. */
const isCurrent = (page: ManifestPage): boolean =>
  isCurrentAnswer({ outDir, name: page.file, prompt: promptFor(page), version: PROMPT_VERSION })

const main = async () => {
  if (mode === '--pending') {
    const pending = todo.filter((p) => !isCurrent(p))
    for (const p of pending) console.log(p.file)
    console.error(`${pending.length} of ${todo.length} page(s) pending`)
    return
  }

  if (mode === '--prompt') {
    const page = pageNamed(rest[0])
    console.log(agentPrompt(promptFor(page), CoursePage))
    return
  }

  if (mode === '--record') {
    const page = pageNamed(rest[0])
    const data = recordAnswer({
      outDir,
      name: page.file,
      prompt: promptFor(page),
      version: PROMPT_VERSION,
      schema: CoursePage, // throws with the exact field on a bad answer
      answerFile: rest[1],
    })
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
        `${JSON.stringify({ sha256: shaOf(PROMPT_VERSION, cached.model, prompt), model: cached.model, version: PROMPT_VERSION, data }, null, 2)}\n`,
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
