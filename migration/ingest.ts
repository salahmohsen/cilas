/**
 * Stage 1 of the import (docs/schema.md, Archive import): catalogue every
 * page and upload. Later stages read migration/manifest.json, not raw files.
 *
 *   npx tsx migration/ingest.ts migration/raw
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

import { classifyPage, legacyUrlOf, type PageKind } from './lib/classify'
import { resolveUpload } from './lib/uploads'

const raw = process.argv[2]
if (!raw) throw new Error('Usage: npx tsx migration/ingest.ts <raw dir>')

const zip = path.join(raw, 'weebly-zip-2025-04-23')
const mirror = path.join(raw, 'mirror')
const overrides = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'page-kinds.json'), 'utf8'),
) as Record<string, PageKind>

const listFiles = (dir: string, rel = ''): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const relPath = rel ? `${rel}/${e.name}` : e.name
    return e.isDirectory() ? listFiles(path.join(dir, e.name), relPath) : [relPath]
  })

const zipUploads = listFiles(path.join(zip, 'uploads'), 'uploads')
const mirrorUploads = (() => {
  try {
    return listFiles(path.join(mirror, 'uploads'), 'uploads')
  } catch {
    return []
  }
})()
const allUploads = new Set([...zipUploads, ...mirrorUploads])

type Page = {
  legacy_url: string
  file: string
  source: 'zip' | 'mirror'
  kind: PageKind
  title: string
  links: string[]
  uploads: Array<{ path: string; missing: boolean }>
}

const read = (source: Page['source'], dir: string): Page[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .map((file) => {
      const { document } = new JSDOM(readFileSync(path.join(dir, file), 'utf8')).window
      const hrefs = [...document.querySelectorAll('a[href], img[src]')].map(
        (el) => el.getAttribute('href') ?? el.getAttribute('src') ?? '',
      )
      const uploads = new Map<string, { path: string; missing: boolean }>()
      const links = new Set<string>()
      for (const href of hrefs) {
        const upload = resolveUpload(href, allUploads)
        if (upload) uploads.set(upload.path, upload)
        else if (/^\/?[^/:?#]+\.html/.test(href)) links.add(legacyUrlOf(href.replace(/^\//, '').split(/[?#]/)[0]))
      }
      return {
        legacy_url: legacyUrlOf(file),
        file,
        source,
        kind: classifyPage(file, overrides),
        title: document.title.replace(/\s*-\s*(CILAS|Cairo Institute).*$/i, '').trim(),
        links: [...links].sort(),
        uploads: [...uploads.values()].sort((a, b) => a.path.localeCompare(b.path)),
      }
    })

const zipPages = read('zip', zip)
const known = new Set(zipPages.map((p) => p.file))
const pages = [...zipPages, ...read('mirror', path.join(mirror, 'pages')).filter((p) => !known.has(p.file))]
  .sort((a, b) => a.legacy_url.localeCompare(b.legacy_url))

const referencedBy = new Map<string, string[]>()
for (const page of pages) {
  for (const u of page.uploads) referencedBy.set(u.path, [...(referencedBy.get(u.path) ?? []), page.legacy_url])
}
const uploads = [...allUploads]
  .sort()
  .map((p) => ({
    path: p,
    source: zipUploads.includes(p) ? 'zip' : 'mirror',
    referenced_by: referencedBy.get(p) ?? [],
  }))

const manifest = { generated_from: 'weebly-zip-2025-04-23 + cilas.lkssystems.com', pages, uploads }
writeFileSync(path.join(import.meta.dirname, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const byKind = pages.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] ?? 0) + 1 }), {})
console.log(`${pages.length} pages`, byKind)
console.log(`${uploads.length} uploads, ${uploads.filter((u) => u.referenced_by.length).length} referenced`)
console.log(`${pages.flatMap((p) => p.uploads).filter((u) => u.missing).length} upload link(s) missing`)
