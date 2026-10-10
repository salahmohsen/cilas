/**
 * Checks the extracted syllabi against their flows → migration/review/flows.md:
 *   npx tsx migration/verify-flows.ts migration/raw
 * Every link of a PDF must land in the syllabus, and the session count must be
 * close to the unit markers in the text (ADR 0004).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { Syllabus } from './lib/syllabus-schema'
import { missingLinks, sessionMismatch, unitMarkers } from './lib/verify-flows'

const [raw] = process.argv.slice(2)
if (!raw) throw new Error('Usage: verify-flows.ts <raw dir>')

type Flow = { id: string; upload: string; source: 'zip' | 'mirror' | null; method: string; courses: string[] }
const here = import.meta.dirname
const flows = JSON.parse(readFileSync(path.join(here, 'flows.json'), 'utf8')) as Flow[]
const flowDir = (id: string) => path.join(path.resolve(raw), 'flows', id)

const missingFiles: string[] = []
const notExtracted: string[] = []
const linkGaps: { id: string; urls: string[] }[] = []
const countChecks: { id: string; markers: number; sessions: number }[] = []
const empty: string[] = []

for (const f of flows) {
  if (!f.source) {
    missingFiles.push(f.id)
    continue
  }
  const file = path.join(here, 'extracted', 'flows', `${f.id}.json`)
  if (!existsSync(file)) {
    notExtracted.push(f.id)
    continue
  }
  const syllabus = Syllabus.parse((JSON.parse(readFileSync(file, 'utf8')) as { data: unknown }).data)

  const linksFile = path.join(flowDir(f.id), 'links.json')
  if (existsSync(linksFile)) {
    const links = (JSON.parse(readFileSync(linksFile, 'utf8')) as { url: string }[]).map((l) => l.url)
    const missing = missingLinks(links, syllabus)
    if (missing.length) linkGaps.push({ id: f.id, urls: missing })
  }

  const text = readFileSync(path.join(flowDir(f.id), f.method === 'vision' ? 'ocr.txt' : 'text.txt'), 'utf8')
  const markers = unitMarkers(text)
  if (syllabus.sessions.length === 0) empty.push(f.id)
  else if (sessionMismatch(markers, syllabus.sessions.length))
    countChecks.push({ id: f.id, markers, sessions: syllabus.sessions.length })
}

const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '_none_')
const report = `# Course flows: checks against the source

## Missing files

${list(missingFiles)}

## Not yet extracted

${list(notExtracted)}

## Links not captured

${linkGaps.length ? linkGaps.map((g) => `- ${g.id}\n${g.urls.map((u) => `  - ${u}`).join('\n')}`).join('\n') : '_none_'}

## Session count to check

${list(countChecks.map((c) => `${c.id}: ${c.markers} marker(s), ${c.sessions} session(s)`))}

## Empty syllabi

${list(empty)}
`
mkdirSync(path.join(here, 'review'), { recursive: true })
writeFileSync(path.join(here, 'review', 'flows.md'), report)
console.log(
  `${flows.length} flow(s): ${missingFiles.length} missing file(s), ${notExtracted.length} not extracted, ${linkGaps.length} with links not captured, ${countChecks.length} session count(s) to check, ${empty.length} empty`,
)
