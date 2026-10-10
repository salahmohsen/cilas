/**
 * Derives what the flow extraction reads, from the archived course-flow files:
 *   npx tsx migration/prepare-flows.ts migration/raw
 * Per flow, into migration/raw/flows/<id>/ (gitignored): text.txt, ocr.txt,
 * page-N.png, links.json. Writes migration/flows.json (committed).
 * Idempotent: a step whose output exists is skipped. The files are untrusted:
 * tools get argument arrays (no shell) and nothing runs from inside raw/.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { arabicShareOf, flowId, methodFor, parseUrls, type FlowMethod } from './lib/flow-files'

const [raw] = process.argv.slice(2)
if (!raw) throw new Error('Usage: prepare-flows.ts <raw dir>')

const here = import.meta.dirname
const rawAbs = path.resolve(raw)
const flowsRoot = path.join(rawAbs, 'flows')
const roots = {
  zip: path.join(rawAbs, 'weebly-zip-2025-04-23'),
  mirror: path.join(rawAbs, 'mirror'),
}

type Course = { legacy_url: string; flow_uploads: string[] }
const courses = JSON.parse(
  readFileSync(path.join(here, '..', 'seed', 'data', 'archive', 'courses.json'), 'utf8'),
) as Course[]

const normalise = (u: string): string => {
  const clean = u.split(/[?#]/)[0]
  try {
    return decodeURIComponent(clean)
  } catch {
    return clean
  }
}

// upload (normalised) -> course legacy urls
const uploads = new Map<string, Set<string>>()
for (const c of courses) {
  for (const u of c.flow_uploads) {
    const key = normalise(u)
    if (!uploads.has(key)) uploads.set(key, new Set())
    uploads.get(key)!.add(c.legacy_url)
  }
}

const locate = (upload: string): { source: 'zip' | 'mirror'; file: string } | null => {
  for (const source of ['zip', 'mirror'] as const) {
    const file = path.join(roots[source], upload)
    if (existsSync(file)) return { source, file }
  }
  return null
}

const run = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60_000 })

// deterministic ids: sorted upload order; later slug collisions get -2, -3…
const sorted = [...uploads.keys()].sort()
const used = new Set<string>()
const collisions: string[] = []
const entries: {
  id: string
  upload: string
  source: 'zip' | 'mirror' | null
  method: FlowMethod
  pages: number | null
  links: number
  arabic_share: number
  courses: string[]
}[] = []
const failures: string[] = []

for (const upload of sorted) {
  let id = flowId(upload)
  if (used.has(id)) {
    let n = 2
    while (used.has(`${id}-${n}`)) n++
    collisions.push(`${upload} -> ${id}-${n}`)
    id = `${id}-${n}`
  }
  used.add(id)

  const found = locate(upload)
  const courseUrls = [...uploads.get(upload)!].sort()
  const isDoc = /\.docx?$/i.test(upload)
  if (!found) {
    entries.push({ id, upload, source: null, method: isDoc ? 'docx' : 'text', pages: null, links: 0, arabic_share: 0, courses: courseUrls })
    continue
  }

  const dir = path.join(flowsRoot, id)
  mkdirSync(dir, { recursive: true })
  const textFile = path.join(dir, 'text.txt')
  let pages: number | null = null
  let links = 0
  let share = 0
  let method: FlowMethod = 'docx'
  try {
    if (isDoc) {
      if (!existsSync(textFile)) run('textutil', ['-convert', 'txt', '-output', textFile, found.file])
      share = arabicShareOf(readFileSync(textFile, 'utf8'))
    } else {
      if (!existsSync(textFile)) run('pdftotext', ['-layout', found.file, textFile])
      share = arabicShareOf(readFileSync(textFile, 'utf8'))
      method = methodFor(upload, share)
      const info = run('pdfinfo', [found.file])
      pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? NaN)
      if (!Number.isFinite(pages)) pages = null
      const linksFile = path.join(dir, 'links.json')
      if (!existsSync(linksFile)) {
        const urls = parseUrls(run('pdfinfo', ['-url', found.file]))
        writeFileSync(linksFile, `${JSON.stringify(urls, null, 2)}\n`)
      }
      links = (JSON.parse(readFileSync(linksFile, 'utf8')) as unknown[]).length

      if (method === 'vision') {
        const pngs = () => readdirSync(dir).filter((f) => /^page-\d+\.png$/.test(f))
        if (pngs().length === 0) run('pdftoppm', ['-r', '150', '-png', found.file, path.join(dir, 'page')])
        const ocrFile = path.join(dir, 'ocr.txt')
        if (!existsSync(ocrFile)) {
          const ordered = pngs().sort((a, b) => parseInt(a.slice(5), 10) - parseInt(b.slice(5), 10))
          let out = ''
          ordered.forEach((png, i) => {
            const text = run('tesseract', [path.join(dir, png), '-', '-l', 'ara+eng', '--psm', '4'])
            out += `--- page ${i + 1} ---\n${text}\n`
          })
          writeFileSync(ocrFile, out)
        }
      }
    }
  } catch (e) {
    failures.push(`${id}: ${(e as Error).message.split('\n')[0]}`)
  }
  entries.push({ id, upload, source: found.source, method, pages, links, arabic_share: Math.round(share * 1000) / 1000, courses: courseUrls })
  console.error(`${entries.length}/${sorted.length} ${id} (${method})`)
}

entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
writeFileSync(path.join(here, 'flows.json'), `${JSON.stringify(entries, null, 2)}\n`)

const by = (m: string) => entries.filter((e) => e.method === m && e.source).length
console.log(
  `${entries.length} flow(s): text ${by('text')}, vision ${by('vision')}, docx ${by('docx')}, missing ${entries.filter((e) => !e.source).length}; ${entries.reduce((n, e) => n + e.links, 0)} link(s)`,
)
if (collisions.length) console.log(`id collisions disambiguated:\n${collisions.join('\n')}`)
if (failures.length) console.log(`FAILURES:\n${failures.join('\n')}`)
