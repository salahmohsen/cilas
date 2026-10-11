/**
 * Derives what the long-document extraction reads, from the archived PDFs:
 *   npx tsx migration/prepare-docs.ts migration/raw
 * Per document, into migration/raw/docs/<id>/ (gitignored): page-N.txt, and for
 * documents read from images page-N.png + page-N.ocr.txt, plus links.json.
 * Writes migration/docs.json (committed). Idempotent: a step whose output
 * exists is skipped. The files are untrusted: tools get argument arrays (no
 * shell) and nothing runs from inside raw/.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { arabicShareOf, parseUrls } from './lib/flow-files'

const [raw] = process.argv.slice(2)
if (!raw) throw new Error('Usage: prepare-docs.ts <raw dir>')

const here = import.meta.dirname
const rawAbs = path.resolve(raw)
const UPLOAD_DIR = 'uploads/1/9/1/0/19102967'
const roots = [path.join(rawAbs, 'weebly-zip-2025-04-23'), path.join(rawAbs, 'mirror')]

/**
 * The documents. The Arabic book's real file name holds a combining kasra
 * (U+0650) after the hyphen, so files are found by reading the directory and
 * matching a pattern, never by typing the name.
 */
const DOCS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: 'on_the_emergence_of_pigeon_towers_-_english',
    pattern: /^on_the_emergence_of_pigeon_towers_-_english\.pdf$/,
  },
  {
    id: 'on_the_emergence_of_pigeon_towers_-_arabic',
    pattern: /^on_the_emergence_of_pigeon_towers_-_ِ?arabic\.pdf$/,
  },
  { id: 'translation_lab_works', pattern: /^translation_lab_works\.pdf$/ },
  { id: 'cilas_newsletter_issue_no._1', pattern: /^cilas_newsletter_issue_no\._1\.pdf$/ },
]

const run = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60_000 })

const locate = (pattern: RegExp): { dir: string; name: string } | null => {
  for (const root of roots) {
    const dir = path.join(root, UPLOAD_DIR)
    if (!existsSync(dir)) continue
    const name = readdirSync(dir).find((f) => pattern.test(f.normalize('NFC')) || pattern.test(f))
    if (name) return { dir, name }
  }
  return null
}

const entries: Array<{ id: string; file: string; pages: number; method: 'text' | 'vision' }> = []
const failures: string[] = []

for (const doc of DOCS) {
  const found = locate(doc.pattern)
  if (!found) {
    failures.push(`${doc.id}: file not found`)
    continue
  }
  const pdf = path.join(found.dir, found.name)
  const dir = path.join(rawAbs, 'docs', doc.id)
  mkdirSync(dir, { recursive: true })
  try {
    const pages = Number(/^Pages:\s+(\d+)/m.exec(run('pdfinfo', [pdf]))?.[1] ?? NaN)
    if (!Number.isFinite(pages)) throw new Error('no page count')

    for (let n = 1; n <= pages; n++) {
      const file = path.join(dir, `page-${n}.txt`)
      if (!existsSync(file))
        writeFileSync(
          file,
          run('pdftotext', ['-layout', '-f', String(n), '-l', String(n), pdf, '-']),
        )
    }
    const text = Array.from({ length: pages }, (_, i) =>
      readFileSync(path.join(dir, `page-${i + 1}.txt`), 'utf8'),
    ).join('\n')
    const method = arabicShareOf(text) > 0.2 ? 'vision' : 'text'

    const linksFile = path.join(dir, 'links.json')
    if (!existsSync(linksFile))
      writeFileSync(
        linksFile,
        `${JSON.stringify(parseUrls(run('pdfinfo', ['-url', pdf])), null, 2)}\n`,
      )

    if (method === 'vision') {
      for (let n = 1; n <= pages; n++) {
        const png = path.join(dir, `page-${n}.png`)
        if (!existsSync(png)) {
          // -singlefile writes exactly <prefix>.png, whatever the page count
          run('pdftoppm', [
            '-r',
            '150',
            '-png',
            '-singlefile',
            '-f',
            String(n),
            '-l',
            String(n),
            pdf,
            path.join(dir, `page-${n}`),
          ])
        }
        const ocr = path.join(dir, `page-${n}.ocr.txt`)
        if (!existsSync(ocr))
          writeFileSync(ocr, run('tesseract', [png, '-', '-l', 'ara+eng', '--psm', '4']))
      }
    }
    entries.push({ id: doc.id, file: `${UPLOAD_DIR}/${found.name}`, pages, method })
    console.error(`${doc.id}: ${pages} page(s), ${method}`)
  } catch (e) {
    failures.push(`${doc.id}: ${(e as Error).message.split('\n')[0]}`)
  }
}

writeFileSync(path.join(here, 'docs.json'), `${JSON.stringify(entries, null, 2)}\n`)
for (const e of entries) console.log(`${e.id}: ${e.pages} page(s), ${e.method}`)
if (failures.length) console.log(`FAILURES:\n${failures.join('\n')}`)
