/**
 * Stage 4 for media: upload the archive's images and PDFs to the media
 * collection (R2) and set the fields that point at them. Idempotent: a file
 * already imported is reused, and no field that has a value is overwritten.
 *
 *   npx tsx --env-file=.env migration/seed-media.ts migration/raw --dry
 *   npx tsx --env-file=.env migration/seed-media.ts migration/raw
 *
 * --dry prints the counts and total size and writes nothing.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'

import { courseImagesOnPage } from './lib/course-images'
import { importMedia, type ResolvedFile } from './lib/import-media'
import { mediaJobs, pdfJobs, uniquePaths, type MediaJob } from './lib/media-plan'
import { pageText } from './lib/page-text'
import { resolveUpload } from './lib/uploads'

const raw = process.argv[2]
const dry = process.argv.includes('--dry')
if (!raw || raw.startsWith('--'))
  throw new Error('Usage: npx tsx --env-file=.env migration/seed-media.ts <raw dir> [--dry]')

const here = import.meta.dirname
const archive = path.join(here, '..', 'seed', 'data', 'archive')
const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T

const zip = path.join(raw, 'weebly-zip-2025-04-23')
const mirror = path.join(raw, 'mirror')
const listFiles = (dir: string, rel = ''): string[] =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const relPath = rel ? `${rel}/${e.name}` : e.name
        return e.isDirectory() ? listFiles(path.join(dir, e.name), relPath) : [relPath]
      })
    : []
const zipFiles = new Set(listFiles(path.join(zip, 'uploads'), 'uploads'))
const allFiles = new Set([...zipFiles, ...listFiles(path.join(mirror, 'uploads'), 'uploads')])

const resolve = (p: string): ResolvedFile => {
  const r = resolveUpload(p, allFiles) ?? { path: p, missing: !allFiles.has(p) }
  if (r.missing) return { key: r.path, file: null }
  return { key: r.path, file: path.join(zipFiles.has(r.path) ? zip : mirror, r.path) }
}

type Manifest = {
  pages: Array<{ legacy_url: string; file: string; source: 'zip' | 'mirror'; kind: string }>
}
type Docs = Array<{ id: string; file: string }>

const build = () => {
  const manifest = read<Manifest>(path.join(here, 'manifest.json'))
  const docs = read<Docs>(path.join(here, 'docs.json'))
  const people = read<Array<{ name: string; legacy_url: string; photo?: string | null }>>(
    path.join(archive, 'people.json'),
  )
  const press = read<Array<{ outlet: string | null; logo?: string | null }>>(
    path.join(archive, 'press.json'),
  )
  const publications = read<
    Array<{
      legacy_url: string
      title_en: string
      title_ar: string | null
      print_edition_url?: string | null
    }>
  >(path.join(archive, 'publications.json'))
  const newsletters = read<
    Array<{ legacy_url: string; title_en: string; archive_url?: string | null }>
  >(path.join(archive, 'newsletters.json'))
  const courses = read<Array<{ legacy_url: string; title: string; title_ar: string | null }>>(
    path.join(archive, 'courses.json'),
  )

  const wanted = new Set([
    ...publications.map((p) => p.legacy_url),
    ...courses.map((c) => c.legacy_url.split('#')[0]),
  ])
  const pages = manifest.pages
    .filter((p) => wanted.has(p.legacy_url))
    .map((p) => ({
      legacy_url: p.legacy_url,
      kind: p.kind,
      text: pageText(
        readFileSync(
          path.join(p.source === 'zip' ? zip : path.join(mirror, 'pages'), p.file),
          'utf8',
        ),
      ),
    }))

  // Courses that share a cycle page: each one's image from its own block there.
  const byPage = new Map<string, typeof courses>()
  for (const c of courses)
    byPage.set(c.legacy_url.split('#')[0], [...(byPage.get(c.legacy_url.split('#')[0]) ?? []), c])
  const shared: MediaJob[] = []
  for (const [url, list] of byPage) {
    const page = manifest.pages.find((p) => p.legacy_url === url)
    if (list.length < 2 || !page) continue
    const html = readFileSync(
      path.join(page.source === 'zip' ? zip : path.join(mirror, 'pages'), page.file),
      'utf8',
    )
    const found = courseImagesOnPage(
      html,
      list.map((c) => ({
        legacy_url: c.legacy_url,
        titles: [c.title, c.title_ar ?? ''].filter(Boolean),
      })),
    )
    for (const c of list) {
      const image = found.get(c.legacy_url)
      if (image)
        shared.push({
          collection: 'courses',
          legacy_url: c.legacy_url,
          field: 'cover_image',
          path: image,
          alt: c.title || c.title_ar || '',
        })
    }
  }

  const jobs: MediaJob[] = [
    ...mediaJobs({ people, press, publications, courses, pages }),
    ...shared,
    ...pdfJobs({ publications, newsletters }),
  ]
  const attached = new Set(jobs.map((j) => resolve(j.path).key))
  const extras = docs
    .filter((d) => !attached.has(resolve(d.file).key))
    .map((d) => ({
      path: d.file,
      alt: d.id
        .replace(/[_-]+/g, ' ')
        .replace(/^./, (c) => c.toUpperCase())
        .trim(),
    }))

  const covered = new Set(jobs.filter((j) => j.collection === 'courses').map((j) => j.legacy_url))
  const noCover = courses.filter((c) => !covered.has(c.legacy_url)).length
  return { jobs, extras, noCover }
}

const main = async () => {
  const { jobs, extras, noCover } = build()
  const all = [...uniquePaths(jobs), ...extras.map((e) => e.path)]
  const files = new Map(all.map((p) => [resolve(p).key, resolve(p).file]))

  if (dry) {
    const by = new Map<string, number>()
    for (const j of jobs)
      by.set(`${j.collection}.${j.field}`, (by.get(`${j.collection}.${j.field}`) ?? 0) + 1)
    for (const [k, n] of by) console.log(`${k.padEnd(28)} ${n} jobs`)
    console.log(`extra uploads (no field): ${extras.map((e) => e.path).join(', ') || 'none'}`)
    const found = [...files.values()].filter((f): f is string => Boolean(f))
    const missing = [...files].filter(([, f]) => !f).map(([k]) => k)
    const bytes = found.reduce((sum, f) => sum + statSync(f).size, 0)
    console.log(
      `jobs ${jobs.length}, unique files ${files.size}: found ${found.length}, missing ${missing.length}`,
    )
    console.log(`total ${(bytes / 1024 / 1024).toFixed(1)} MB (${bytes} bytes)`)
    for (const m of missing) console.log(`  missing: ${m}`)
    console.log(`courses without a cover (no page of their own): ${noCover}`)
    return
  }

  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })
  const { urls, noTargetJobs, ...tally } = await importMedia(payload, jobs, resolve, extras)
  console.log(
    `uploaded ${tally.uploaded}, reused ${tally.reused}, attached ${tally.attached}, skipped (already set) ${tally.skippedSet}, missing file ${tally.missing}, no target document ${tally.noTarget}`,
  )

  const lines = [
    '# Media import',
    '',
    `Uploaded ${tally.uploaded}, reused ${tally.reused}, attached ${tally.attached}, missing ${tally.missing}.`,
    '',
    `- ${noCover} courses have no cover: no image on their page, or none that is theirs alone.`,
    '- Pigeon Towers `print_edition_url` is the English PDF (the field holds one URL). The Arabic PDF is uploaded too:',
    ...extras.map((e) => `  - ${e.alt}: ${urls.get(e.path) ?? '(not uploaded)'}`),
    '',
    '## Files not in the archive',
    ...jobs
      .filter((j) => !resolve(j.path).file)
      .map((j) => `- ${j.collection} ${j.legacy_url ?? j.name} (${j.field}): ${j.path}`),
    '',
    '## No document to attach to',
    ...noTargetJobs.map((j) => `- ${j}`),
  ]
  writeFileSync(path.join(here, 'review', 'media.md'), lines.join('\n') + '\n')
  await payload.destroy()
  process.exit(0)
}

main()
