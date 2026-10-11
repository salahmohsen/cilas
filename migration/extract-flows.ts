import { createHash } from 'node:crypto'
/**
 * Stage 2 for the course flows → migration/extracted/flows/<id>.json.
 * An agent works flow by flow, on the Claude Code subscription (no API key):
 *   npx tsx migration/extract-flows.ts migration/raw --pending
 *   npx tsx migration/extract-flows.ts migration/raw --prompt <id>
 *   npx tsx migration/extract-flows.ts migration/raw --record <id> <answer.json>
 * Input comes from prepare-flows.ts. The prompt (and so the hash) includes the
 * page-image paths, not the image bytes: they are derived from the PDF.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { agentPrompt, isCurrent, recordAnswer, shaOf } from './lib/agent-extract'
import { FLOW_PROMPT_VERSION, flowPrompt, Syllabus } from './lib/syllabus-schema'

const [raw, mode, ...rest] = process.argv.slice(2)
if (!raw || !mode) {
  throw new Error('Usage: extract-flows.ts <raw dir> --pending | --prompt <id> | --record <id> <answer.json>')
}

type Flow = {
  id: string
  source: 'zip' | 'mirror' | null
  method: 'text' | 'mixed' | 'vision' | 'docx'
  courses: string[]
}

const here = import.meta.dirname
const outDir = path.join(here, 'extracted', 'flows')
const flowDir = (id: string) => path.join(path.resolve(raw), 'flows', id)

const flows = (JSON.parse(readFileSync(path.join(here, 'flows.json'), 'utf8')) as Flow[]).filter(
  (f) => f.source,
)
const titles = new Map(
  (
    JSON.parse(
      readFileSync(path.join(here, '..', 'seed', 'data', 'archive', 'courses.json'), 'utf8'),
    ) as { legacy_url: string; title: string }[]
  ).map((c) => [c.legacy_url, c.title]),
)

const imagesOf = (id: string): string[] =>
  readdirSync(flowDir(id))
    .filter((f) => /^page-\d+\.png$/.test(f))
    .sort((a, b) => parseInt(a.slice(5), 10) - parseInt(b.slice(5), 10))
    .map((f) => path.join(flowDir(id), f))

const promptFor = (f: Flow): string =>
  flowPrompt({
    id: f.id,
    method: f.method,
    courses: f.courses.map((url) => titles.get(url) ?? url),
    text: readFileSync(path.join(flowDir(f.id), f.method === 'vision' ? 'ocr.txt' : 'text.txt'), 'utf8'),
    images: f.method === 'vision' || f.method === 'mixed' ? imagesOf(f.id) : [],
    links: existsSync(path.join(flowDir(f.id), 'links.json'))
      ? (JSON.parse(readFileSync(path.join(flowDir(f.id), 'links.json'), 'utf8')) as Array<{ page: number; url: string }>)
      : [],
  })

const flowNamed = (id: string): Flow => {
  const f = flows.find((x) => x.id === id)
  if (!f) throw new Error(`${id} is not an extractable flow`)
  return f
}

if (mode === '--rehash-paths') {
  // One-off after hashes became repo-relative: re-stamp answers whose stored
  // hash matches the old absolute-path formula for exactly the same prompt.
  const legacy = (version: string, model: string, prompt: string) =>
    createHash('sha256').update(`${version}\n${model}\n${prompt}`).digest('hex')
  let restamped = 0
  for (const f of flows) {
    const file = path.join(outDir, `${f.id}.json`)
    if (!existsSync(file)) continue
    const cached = JSON.parse(readFileSync(file, 'utf8')) as { sha256: string; model: string; version: string }
    const prompt = promptFor(f)
    if (cached.sha256 !== legacy(FLOW_PROMPT_VERSION, cached.model, prompt)) continue
    writeFileSync(file, `${JSON.stringify({ ...cached, sha256: shaOf(FLOW_PROMPT_VERSION, cached.model, prompt) }, null, 2)}\n`)
    restamped++
  }
  console.log(`re-stamped ${restamped} flow answer(s)`)
} else if (mode === '--pending') {
  const pending = flows.filter(
    (f) => !isCurrent({ outDir, name: f.id, prompt: promptFor(f), version: FLOW_PROMPT_VERSION }),
  )
  for (const f of pending) console.log(f.id)
  console.error(`${pending.length} of ${flows.length} flow(s) pending`)
} else if (mode === '--prompt') {
  console.log(agentPrompt(promptFor(flowNamed(rest[0])), Syllabus))
} else if (mode === '--record') {
  const f = flowNamed(rest[0])
  const data = recordAnswer({
    outDir,
    name: f.id,
    prompt: promptFor(f),
    version: FLOW_PROMPT_VERSION,
    schema: Syllabus, // throws with the exact field on a bad answer
    answerFile: rest[1],
  })
  console.log(`${f.id}: recorded, ${data.sessions.length} session(s)`)
} else {
  throw new Error(`Unknown mode ${mode}`)
}
