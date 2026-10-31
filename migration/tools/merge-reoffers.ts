/**
 * One course doc per course (decided 2026-10-13): a course the archive shows
 * in two cycles — same title and same fellows, or the same description — is
 * kept once. The copy with more sessions stays (the later one on a tie); it
 * takes from the other whatever it lacks (cover, text, bibliography),
 * redirects to the other move to it, and the other is deleted.
 *
 *   npx tsx --env-file=.env migration/tools/merge-reoffers.ts [--dry]
 */
import { getPayload, type Payload } from 'payload'

const dry = process.argv.includes('--dry')
/** Same text under two titles. */
const EXTRA_PAIRS: Array<[string, string]> = [
  ['/the-philosophy-of-soren-kierkegaard.html', '/quality-time-with-kierkegaard.html'],
]

type Loc = Record<string, unknown> | null | undefined
type Course = {
  id: number
  legacy_url?: string | null
  title: Record<string, string | null>
  fellows?: number[] | null
  sessions?: unknown[] | null
  bibliography?: unknown[] | null
  cover_image?: number | null
  cycle: { id: number; start_year: number; season: string }
  [k: string]: unknown
}

const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٟ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
const SEASON = { winter: 0, spring: 1, summer: 2, fall: 3 } as Record<string, number>
const when = (c: Course) => c.cycle.start_year * 4 + SEASON[c.cycle.season]
const empty = (v: unknown) =>
  v == null ||
  v === '' ||
  (Array.isArray(v) && !v.length) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.values(v as object).every(empty))

const LOCALIZED = [
  'subtitle',
  'summary',
  'epigraph',
  'description',
  'facilitator_note',
  'content_warning',
  'language_note',
] as const

const merge = async (payload: Payload, keep: Course, drop: Course, log: string[]) => {
  log.push(
    `keep ${keep.id} ${keep.legacy_url} (${keep.cycle.season} ${keep.cycle.start_year}) ← drop ${drop.id} ${drop.legacy_url} (${drop.cycle.season} ${drop.cycle.start_year})`,
  )
  if (dry) return
  for (const locale of ['en', 'ar'] as const) {
    const data: Record<string, unknown> = {}
    for (const f of LOCALIZED) {
      const k = (keep[f] as Loc)?.[locale]
      const d = (drop[f] as Loc)?.[locale]
      if (empty(k) && !empty(d)) data[f] = d
    }
    if (locale === 'ar' && !keep.title.ar && drop.title.ar) data.title = drop.title.ar
    if (Object.keys(data).length)
      await payload.update({
        collection: 'courses',
        id: keep.id,
        data,
        locale,
        draft: true,
        overrideAccess: true,
      })
  }
  if (!keep.cover_image && drop.cover_image) {
    await payload.update({
      collection: 'courses',
      id: keep.id,
      data: { cover_image: drop.cover_image },
      draft: true,
      overrideAccess: true,
    })
  }
  const { docs: redirects } = await payload.find({
    collection: 'redirects',
    where: {
      and: [
        { 'to.reference.relationTo': { equals: 'courses' } },
        { 'to.reference.value': { equals: drop.id } },
      ],
    },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  for (const r of redirects) {
    await payload.update({
      collection: 'redirects',
      id: r.id,
      data: { to: { type: 'reference', reference: { relationTo: 'courses', value: keep.id } } },
      overrideAccess: true,
    })
  }
  await payload.delete({ collection: 'courses', id: drop.id, overrideAccess: true })
  await payload.update({
    collection: 'courses',
    id: keep.id,
    data: { _status: 'published' },
    overrideAccess: true,
  })
}

const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
const { docs } = await payload.find({
  collection: 'courses',
  limit: 1000,
  pagination: false,
  depth: 1,
  draft: true,
  locale: 'all',
  overrideAccess: true,
})
const courses = (docs as unknown as Course[]).map((c) => ({
  ...c,
  fellows: (c.fellows ?? []).map((f) => (typeof f === 'object' ? (f as { id: number }).id : f)),
  cover_image:
    c.cover_image && typeof c.cover_image === 'object'
      ? (c.cover_image as { id: number }).id
      : c.cover_image,
}))
const byUrl = new Map(courses.map((c) => [c.legacy_url, c]))

const pairs: Array<[Course, Course]> = []
for (let i = 0; i < courses.length; i++) {
  for (let j = i + 1; j < courses.length; j++) {
    const a = courses[i]
    const b = courses[j]
    if (!a.legacy_url || !b.legacy_url || a.cycle.id === b.cycle.id) continue
    const titles = (c: Course) =>
      new Set(
        Object.values(c.title)
          .filter(Boolean)
          .map((t) => fold(t as string)),
      )
    const sameTitle = [...titles(a)].some((t) => titles(b).has(t))
    const sharedFellow = (a.fellows ?? []).some((f) => (b.fellows ?? []).includes(f))
    if (sameTitle && sharedFellow) pairs.push([a, b])
  }
}
for (const [x, y] of EXTRA_PAIRS)
  if (byUrl.has(x) && byUrl.has(y)) pairs.push([byUrl.get(x)!, byUrl.get(y)!])

const log: string[] = []
const gone = new Set<number>()
for (const [a, b] of pairs) {
  if (gone.has(a.id) || gone.has(b.id)) continue
  const score = (c: Course) => (c.sessions?.length ?? 0) * 1000 + when(c)
  const [keep, drop] = score(a) >= score(b) ? [a, b] : [b, a]
  await merge(payload, keep, drop, log)
  gone.add(drop.id)
}
console.log(log.join('\n'))
console.log(`${gone.size} merged${dry ? ' (dry run)' : ''}`)
await payload.destroy()
process.exit(0)
