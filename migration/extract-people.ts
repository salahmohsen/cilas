/**
 * Stage 2 for the people pages → migration/extracted/people/<file>.json.
 * An agent works page by page, on the Claude Code subscription (no API key):
 *   npx tsx migration/extract-people.ts migration/raw --pending
 *   npx tsx migration/extract-people.ts migration/raw --prompt <file>
 *   npx tsx migration/extract-people.ts migration/raw --record <file> <answer.json>
 * `--record` validates the answer against the schema before caching it.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { agentPrompt, isCurrent, recordAnswer } from './lib/agent-extract'
import { pageText } from './lib/page-text'
import { PEOPLE_PROMPT_VERSION, PeoplePage, peoplePrompt } from './lib/people-schema'

const [raw, mode, ...rest] = process.argv.slice(2)
if (!raw || !mode) {
  throw new Error(
    'Usage: extract-people.ts <raw dir> --pending | --prompt <file> | --record <file> <answer.json>',
  )
}

/** The pages read as people pages: Cairo and Alexandria cohorts, advisors, trustees. */
const PEOPLE_PAGES = [
  'cilasians-2013-2014.html',
  'cilasians-2014-2015.html',
  'cilasians-2015-2016.html',
  'cilasians-2016-2017.html',
  'cilasians-2017-2018.html',
  'cilas-in-alex-2018-2019.html',
  'cilas-in-alex-2019-2020.html',
  'advisors.html',
  'trustees.html',
]

type ManifestPage = { file: string; source: 'zip' | 'mirror'; kind: string; title: string }
const here = import.meta.dirname
const outDir = path.join(here, 'extracted', 'people')
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: ManifestPage[]
}
const todo = PEOPLE_PAGES.map((file) => {
  const page = pages.find((p) => p.file === file)
  if (!page) throw new Error(`${file} is not in the manifest`)
  return page
})

const dirOf = (source: ManifestPage['source']) =>
  source === 'zip' ? path.join(raw, 'weebly-zip-2025-04-23') : path.join(raw, 'mirror', 'pages')

const promptFor = (page: ManifestPage): string =>
  peoplePrompt({
    file: page.file,
    title: page.title,
    text: pageText(readFileSync(path.join(dirOf(page.source), page.file), 'utf8')),
  })

const pageNamed = (file: string): ManifestPage => {
  const page = todo.find((p) => p.file === file)
  if (!page) throw new Error(`${file} is not a people page`)
  return page
}

if (mode === '--pending') {
  const pending = todo.filter(
    (p) =>
      !isCurrent({ outDir, name: p.file, prompt: promptFor(p), version: PEOPLE_PROMPT_VERSION }),
  )
  for (const p of pending) console.log(p.file)
  console.error(`${pending.length} of ${todo.length} page(s) pending`)
} else if (mode === '--prompt') {
  console.log(agentPrompt(promptFor(pageNamed(rest[0])), PeoplePage))
} else if (mode === '--record') {
  const page = pageNamed(rest[0])
  const data = recordAnswer({
    outDir,
    name: page.file,
    prompt: promptFor(page),
    version: PEOPLE_PROMPT_VERSION,
    schema: PeoplePage, // throws with the exact field on a bad answer
    answerFile: rest[1],
  })
  console.log(`${page.file}: recorded, ${data.people.length} person(s)`)
} else {
  throw new Error(`Unknown mode ${mode}`)
}
