/** Writes every manifest page's text (pageText) to <out>/<file>.txt, for reviewers. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pageText } from '../lib/page-text'

const [raw, out] = process.argv.slice(2)
const here = path.join(import.meta.dirname, '..')
const { pages } = JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8')) as {
  pages: Array<{ file: string; source: 'zip' | 'mirror' }>
}
mkdirSync(out, { recursive: true })
for (const p of pages) {
  const file = p.source === 'zip' ? path.join(raw, 'weebly-zip-2025-04-23', p.file) : path.join(raw, 'mirror', 'pages', p.file)
  writeFileSync(path.join(out, `${p.file}.txt`), pageText(readFileSync(file, 'utf8')))
}
console.log(pages.length)
