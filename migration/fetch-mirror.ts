/**
 * Downloads what the April 2025 ZIP lacks from the live mirror: pages the ZIP
 * doesn't have, and the uploads those pages link to, into migration/raw/mirror/.
 * The ZIP is primary and is never refetched. The mirror has no sitemap, so
 * this crawls breadth-first from the home page. ZIP pages are fetched only to
 * discover links. Already-present files are skipped, so it is safe to re-run.
 *
 *   npx tsx migration/fetch-mirror.ts migration/raw
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { resolveUpload } from './lib/uploads'

const raw = process.argv[2]
if (!raw) throw new Error('Usage: npx tsx migration/fetch-mirror.ts <raw dir>')

const ORIGIN = 'https://cilas.lkssystems.com'
const MAX_PAGES = 400
const DELAY_MS = 200

const zip = path.join(raw, 'weebly-zip-2025-04-23')
const mirror = path.join(raw, 'mirror')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const get = async (url: string): Promise<Buffer | null> => {
  await sleep(DELAY_MS)
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      console.warn(`skip ${url}: HTTP ${res.status}`)
      return null
    }
    return Buffer.from(await res.arrayBuffer())
  } catch (error) {
    console.warn(`skip ${url}: ${String(error)}`)
    return null
  }
}

const save = (to: string, body: Buffer): void => {
  mkdirSync(path.dirname(to), { recursive: true })
  writeFileSync(to, body)
}

const zipFiles = new Set<string>()
const walk = (dir: string, rel = ''): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(path.join(dir, entry.name), relPath)
    else zipFiles.add(relPath)
  }
}
walk(path.join(zip, 'uploads'), 'uploads')
const zipPages = new Set(readdirSync(zip).filter((f) => f.endsWith('.html')))

/** A same-site page file name from a link, or null. */
const pageOf = (href: string): string | null => {
  const clean = href.split(/[?#]/)[0].replace(/^https?:\/\/(www\.)?cilas\.lkssystems\.com\//, '')
  if (/^[a-z]+:|^\/\/|\//.test(clean.replace(/^\//, ''))) return null
  const file = decodeURIComponent(clean.replace(/^\//, ''))
  return file.endsWith('.html') ? file : null
}

const hrefsOf = (html: string): string[] => [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1])

const main = async () => {
  const queue = ['index.html']
  const seen = new Set(queue)
  const missingFromZip: string[] = []
  let savedPages = 0
  let savedUploads = 0

  for (let i = 0; i < queue.length && i < MAX_PAGES; i++) {
    const file = queue[i]
    const inZip = zipPages.has(file)
    const to = path.join(mirror, 'pages', file)

    let html: string
    if (!inZip && existsSync(to)) html = readFileSync(to, 'utf8')
    else {
      const body = await get(`${ORIGIN}/${file === 'index.html' ? '' : encodeURIComponent(file)}`)
      if (!body) continue
      html = body.toString('utf8')
      if (!inZip) {
        save(to, body)
        savedPages++
      }
    }
    if (!inZip) missingFromZip.push(file)

    for (const href of hrefsOf(html)) {
      const next = pageOf(href)
      if (next && !seen.has(next)) {
        seen.add(next)
        queue.push(next)
      }
    }
  }

  // Uploads that the saved pages link to and the ZIP lacks.
  for (const file of missingFromZip) {
    const html = readFileSync(path.join(mirror, 'pages', file), 'utf8')
    for (const href of hrefsOf(html)) {
      const upload = resolveUpload(href, zipFiles)
      if (!upload?.missing) continue
      const to = path.join(mirror, upload.path)
      if (existsSync(to)) continue
      let body = await get(`${ORIGIN}/${encodeURI(upload.path)}`)
      let target = to
      if (!body) {
        // Weebly's `_orig` file may not exist on the mirror; keep the published copy.
        const published = href.split(/[?#]/)[0].replace(/^https?:\/\/[^/]+\//, '').replace(/^\//, '')
        const alt = decodeURIComponent(published)
        if (alt !== upload.path && !existsSync(path.join(mirror, alt))) {
          body = await get(`${ORIGIN}/${encodeURI(alt)}`)
          target = path.join(mirror, alt)
        }
      }
      if (body) {
        save(target, body)
        savedUploads++
      }
    }
  }

  console.log(`discovered ${seen.size} page(s), crawled ${Math.min(queue.length, MAX_PAGES)}`)
  console.log(`pages the ZIP lacks: ${missingFromZip.join(', ')}`)
  console.log(`saved ${savedPages} page(s), ${savedUploads} upload(s)`)
}

main()
