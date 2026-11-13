/**
 * ADR 0011, plan "Move course readers to sessions", unit 1: records what
 * every reader of a course's time gives, for every course, so the move can
 * be checked by a diff (docs/plans/2026-11-13-sessions-readers.md).
 *
 *   pnpm tsx scripts/snapshot-course-readers.ts --label baseline [--url http://localhost:3000]
 *   pnpm tsx scripts/snapshot-course-readers.ts --compare baseline head
 *
 * Writes `.snapshots/course-readers/<label>.json`. `--compare` prints the
 * differences by reader and course, each EXPECTED (the plan's "Expected
 * changes") or UNEXPECTED, and exits non-zero on any UNEXPECTED one.
 *
 * Reads only. Needs `DATABASE_URL` set to the local dev database and a dev
 * server on `--url` over the same database. The calendar items are cached
 * (`unstable_cache` in `api/calendar.api.ts`): after a change to how they are
 * built, change the cache key or clear `.next/cache` before a run.
 *
 * Two kinds of reader:
 * - Black box, over HTTP (what a visitor gets): the course page (facts, the
 *   timing note, the syllabus, the JSON-LD), the llms document, the calendar
 *   feed and the calendar's month list. Only the parts about time are kept.
 * - Readers with no URL of their own, through their exported entry point on
 *   the Payload local API. Each is one line in `ENTRY_POINTS`: a unit that
 *   changes a signature changes that line, and nothing else here.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { createFormatter, createTranslator } from 'next-intl'
import { getPayload } from 'payload'

import { CAIRO } from '../src/lib/cairo-day'
import { getStudyCourses } from '../src/api/courses.api'
import { getFellows } from '../src/api/people.api'
import { getBridgeYear, listBridgeYears } from '../src/api/programmes.api'
import { otherLocale, routing, type Locale } from '../src/i18n/routing'
import { formatsOf } from '../src/i18n/formats'
import { toCourseCard } from '../src/lib/article-cards'
import { nextSession } from '../src/lib/schedule'
import { sessionFacts } from '../src/lib/session-refs'
import { courseLastMeeting } from '../src/lib/space-lifecycle'
import config from '../src/payload.config'
import { syllabusText } from '../src/plugins/typesense/documents'
import type { Course } from '../src/payload-types'
import { decideStartDate, type ResearchEntry } from './archive-start-dates'
import {
  compareSnapshots,
  courseSlugOf,
  formatDifferences,
  icsByCourse,
  llmsTimes,
  type CourseMeta,
  type Snapshot,
} from './course-reader-snapshot'

const DIR = '.snapshots/course-readers'
/** The day every reader that takes one is given, so two runs agree. */
const TODAY = '2026-11-13'
const CONCURRENCY = 4
const LOCALES: readonly Locale[] = routing.locales

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const fileOf = (label: string) => resolve(DIR, `${label}.json`)

/* ------------------------------------------------------------- compare */

const baseLabel = arg('--compare')
if (baseLabel) {
  const headLabel = process.argv[process.argv.indexOf('--compare') + 2]
  if (!headLabel) throw new Error('Usage: --compare <base> <head>')
  const read = (label: string): Snapshot => JSON.parse(readFileSync(fileOf(label), 'utf8'))
  const base = read(baseLabel)
  const diffs = compareSnapshots(base, read(headLabel))
  console.log(formatDifferences(diffs, base))
  process.exit(diffs.some((d) => d.verdict === 'UNEXPECTED') ? 1 : 0)
}

/* ---------------------------------------------------------------- record */

const label = arg('--label')
if (!label) throw new Error('Usage: --label <name> [--url <dev server>]')
const site = (arg('--url') ?? 'http://localhost:3000').replace(/\/+$/, '')

const payload = await getPayload({ config })

/** Runs `fn` on every item, a few at a time, keeping the order. */
const pool = async <T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

/**
 * A page and its status. A 404 is a reader's answer and is recorded; a
 * server error is not. The dev server answers 500 while it recompiles, and
 * restarts its worker when it nears its memory limit, dropping what it was
 * serving: either is asked again after a pause, and a run that still fails
 * stops rather than record it.
 */
const get = async (path: string, attempt = 1): Promise<{ status: number; body: string }> => {
  let failure: string
  try {
    const res = await fetch(`${site}${path}`, { signal: AbortSignal.timeout(180_000) })
    if (res.status < 500)
      return { status: res.status, body: res.status === 200 ? await res.text() : '' }
    failure = `answered ${res.status}`
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error)
  }
  if (attempt >= 5) throw new Error(`${path} failed ${attempt} times: ${failure}`)
  await new Promise((done) => setTimeout(done, attempt * 10_000))
  return get(path, attempt + 1)
}

const squash = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

/* The courses, each in both languages, as the readers' callers load them. */
const loadCourses = async (locale: Locale) =>
  (
    await payload.find({
      collection: 'courses',
      depth: 1,
      pagination: false,
      sort: 'id',
      locale,
      fallbackLocale: otherLocale(locale),
      overrideAccess: true,
    })
  ).docs
const docs = Object.fromEntries(
  await Promise.all(LOCALES.map(async (l) => [l, await loadCourses(l)] as const)),
) as Record<Locale, Course[]>
const courses = docs.en
const idBySlug = new Map(courses.map((c) => [String(c.slug), String(c.id)]))
const byLocale = <T>(fn: (locale: Locale) => T): Record<Locale, T> =>
  Object.fromEntries(LOCALES.map((l) => [l, fn(l)])) as Record<Locale, T>

/* -------------------------------------------- what the plan knows (meta) */

const research: ResearchEntry[] = JSON.parse(
  readFileSync('docs/research/2026-11-course-start-dates.json', 'utf8'),
)
const dated = (e: ResearchEntry) => decideStartDate(e, { start_date: null, weeks: null }).dated
const archiveDated = new Set(research.filter(dated).map((e) => e.id))
const undated = new Set(research.filter((e) => !dated(e)).map((e) => e.id))

const sessionCount = new Map<number, number>()
for (const s of (
  await payload.find({
    collection: 'sessions',
    depth: 0,
    pagination: false,
    select: { course: true },
    overrideAccess: true,
  })
).docs) {
  const course = typeof s.course === 'object' ? s.course.id : s.course
  sessionCount.set(course, (sessionCount.get(course) ?? 0) + 1)
}

const meta: Record<string, CourseMeta> = Object.fromEntries(
  courses.map((c) => [
    String(c.id),
    {
      slug: String(c.slug),
      archiveDated: archiveDated.has(c.id),
      undatedWords: undated.has(c.id),
      // The old rows each became one session; the rest are new and untitled.
      newSessions: Math.max(0, (sessionCount.get(c.id) ?? 0) - (c.sessions?.length ?? 0)),
    },
  ]),
)

/* ----------------------------------------------- black box: over HTTP */

type Readers = Record<string, Record<string, unknown>>
const readers: Readers = {}
const put = (reader: string, course: string, value: unknown) => {
  ;(readers[reader] ??= {})[course] = value
}

/** The course page's time: its facts, timing note, syllabus rows and JSON-LD. */
const pageTimes = (html: string) => {
  const { document } = new JSDOM(html).window
  const dl = document.querySelector('dl.side-card-facts')
  const facts = [...(dl?.children ?? [])].map((row) => {
    const dd = row.querySelector('dd')
    const blocks = [...(dd?.querySelectorAll('span.block') ?? [])]
    const value = blocks.length
      ? blocks.map((b) => squash(b.textContent)).join(' / ')
      : squash(dd?.textContent)
    return `${squash(row.querySelector('dt')?.textContent)}: ${value}`
  })
  const note = [
    ...new Set(
      [...document.querySelectorAll('p.side-card-muted')].map((p) => squash(p.textContent)),
    ),
  ]
  const syllabus = [
    ...document.querySelectorAll('[class*="syllabus-feed-module"][class*="__row"]'),
  ].map((row) => squash(row.textContent))
  const jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap(
      (s) => (JSON.parse(s.textContent ?? '{}')['@graph'] ?? []) as Record<string, unknown>[],
    )
    .filter((n) => n['@type'] === 'Course')
    .map(({ hasCourseInstance, startDate, endDate }) => ({ hasCourseInstance, startDate, endDate }))
  return { facts, note, syllabus, jsonld }
}

console.error(
  `Course pages and llms documents: ${courses.length} courses × ${LOCALES.length} locales…`,
)
const pages = await pool(courses, async (c) => {
  const results = await Promise.all(
    LOCALES.map(async (l) => {
      const path = `/${l}/study/${c.slug}`
      const [page, llms] = await Promise.all([get(path), get(`${path}/llms.txt`)])
      return {
        l,
        page: page.status === 200 ? pageTimes(page.body) : null,
        status: page.status,
        llms: llms.status === 200 ? llmsTimes(llms.body) : { status: llms.status },
      }
    }),
  )
  return { c, results }
})
for (const { c, results } of pages) {
  const id = String(c.id)
  const each = <T>(fn: (r: (typeof results)[number]) => T) =>
    Object.fromEntries(results.map((r) => [r.l, fn(r)]))
  put(
    'page.facts',
    id,
    each((r) => r.page?.facts ?? { status: r.status }),
  )
  put(
    'page.note',
    id,
    each((r) => r.page?.note ?? { status: r.status }),
  )
  put(
    'page.syllabus',
    id,
    each((r) => r.page?.syllabus ?? { status: r.status }),
  )
  put(
    'page.jsonld',
    id,
    each((r) => r.page?.jsonld ?? { status: r.status }),
  )
  put(
    'llms',
    id,
    each((r) => r.llms),
  )
}

console.error('Calendar feed and month lists…')
const months = new Set<string>()
for (const l of LOCALES) {
  const feed = await get(`/${l}/calendar.ics`)
  if (feed.status !== 200) throw new Error(`/${l}/calendar.ics answered ${feed.status}`)
  for (const [slug, entries] of Object.entries(icsByCourse(feed.body))) {
    const id = idBySlug.get(slug)
    if (!id) throw new Error(`The feed names a course not in the database: ${slug}`)
    const value = (readers['calendar.ics']?.[id] ?? {}) as Record<string, string[]>
    put('calendar.ics', id, { ...value, [l]: entries })
    for (const e of entries) {
      const day = /DTSTART[^:]*:(\d{4})(\d{2})/.exec(e)
      if (day) months.add(`${day[1]}-${day[2]}`)
    }
  }
}

/** A month's list (the phone layout of the month view): each course's day, time and note. */
const monthList = (html: string): Array<[string, string]> => {
  const { document } = new JSDOM(html).window
  const out: Array<[string, string]> = []
  for (const day of document.querySelectorAll(
    'div.md\\:hidden ol.cal-agenda > li.cal-agenda-day',
  )) {
    const date = squash(day.querySelector('.cal-agenda-date')?.textContent)
    for (const slot of day.querySelectorAll('li.cal-slot')) {
      const slug = courseSlugOf(slot.querySelector('a')?.getAttribute('href'))
      if (!slug) continue
      const parts = [
        date,
        squash(slot.querySelector('.cal-item-when')?.textContent),
        squash(slot.querySelector('.cal-slot-note')?.textContent),
        slot.hasAttribute('data-cancelled') ? 'cancelled' : '',
      ]
      out.push([slug, parts.join(' | ')])
    }
  }
  return out
}
const monthPaths = [...months]
  .sort()
  .flatMap((m) => LOCALES.map((l) => ({ l, path: `/${l}/calendar?view=month&date=${m}-01` })))
const monthPages = await pool(monthPaths, async ({ l, path }) => {
  const res = await get(path)
  if (res.status !== 200) throw new Error(`${path} answered ${res.status}`)
  return { l, items: monthList(res.body) }
})
const month: Record<string, Record<string, string[]>> = {}
for (const { l, items } of monthPages)
  for (const [slug, line] of items) {
    const id = idBySlug.get(slug)
    if (!id) throw new Error(`The calendar names a course not in the database: ${slug}`)
    ;((month[id] ??= {})[l] ??= []).push(line)
  }
for (const [id, value] of Object.entries(month))
  put(
    'calendar.month',
    id,
    Object.fromEntries(Object.entries(value).map(([l, v]) => [l, v.sort()])),
  )

/* ------------------------------------- entry points: no URL of their own */

const messages = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, 'utf8'))]),
) as Record<Locale, Record<string, unknown>>
// What `i18n/request.ts` gives a page, without the request.
const intlOf = (locale: Locale) => ({
  locale,
  timeZone: CAIRO,
  formats: formatsOf(locale),
  messages: messages[locale],
})
const formatterOf = (locale: Locale) => createFormatter(intlOf(locale))
const translatorOf = (locale: Locale, namespace: string) =>
  createTranslator({ ...intlOf(locale), namespace } as Parameters<typeof createTranslator>[0])

/**
 * One line each: the reader, the entry point it calls, and what it keeps.
 * A unit that changes an entry point's signature changes its line here.
 */
const ENTRY_POINTS: Record<string, (locale: Locale) => Promise<Record<string, unknown>>> = {
  // api/courses.api.ts getStudyCourses: the study list, sorted by start.
  'list.study': async (l) =>
    Object.fromEntries(
      (await getStudyCourses(payload, l, (k) => k, ['public', 'community'])).map((c) => [
        String(c.id),
        c.startDate,
      ]),
    ),
  // api/programmes.api.ts getBridgeYear: each Bridge year's courses in start order.
  'list.programmes': async (l) => {
    const out: Record<string, string[]> = {}
    for (const { slug } of await listBridgeYears(payload, l)) {
      const year = await getBridgeYear(payload, l, { slug })
      for (const s of year?.semesters ?? [])
        for (const p of s.parts)
          for (const c of p.courses) (out[String(c.id)] ??= []).push(`${slug}: ${c.startDate}`)
    }
    return out
  },
  // api/people.api.ts getFellows: each fellow's courses, newest start first.
  'list.fellows': async (l) =>
    Object.fromEntries(
      (await getFellows(payload, l)).flatMap((f) =>
        f.courses.map((c) => [idBySlug.get(c.slug) ?? c.slug, c.start]),
      ),
    ),
  // lib/article-cards.ts toCourseCard: a person page's course card, date and length.
  'list.articleCards': async (l) => {
    const format = formatterOf(l) as Parameters<typeof toCourseCard>[1]['format']
    const t = translatorOf(l, 'Course')
    return Object.fromEntries(
      docs[l].map((c) => {
        const card = toCourseCard(c, {
          locale: l,
          format,
          weeksLabel: (w) => t('weeks', { count: w }),
          and: 'and',
        })
        return [
          String(c.id),
          { date: card.date, dateLabel: card.dateLabel, length: card.readTimeLabel },
        ]
      }),
    )
  },
  // plugins/typesense/documents.ts syllabusText: the search index's syllabus text.
  'search.syllabus': async (l) =>
    Object.fromEntries(
      docs[l].map((c) => [String(c.id), syllabusText(c as unknown as Record<string, unknown>)]),
    ),
  // lib/space-lifecycle.ts courseLastMeeting: the day a course space's 14 days start.
  // (`archiveOf` also reads Date.now(), which no caller can fix: only the last meeting is kept.)
  'space.lastMeeting': async (l) =>
    Object.fromEntries(docs[l].map((c) => [String(c.id), courseLastMeeting(c)])),
  // components/space/space-page.tsx: the space's "next session", from TODAY.
  'space.nextSession': async (l) =>
    Object.fromEntries(
      docs[l].map((c) => {
        const next = nextSession(c.schedule, c.sessions, TODAY)
        return [
          String(c.id),
          next && { n: next.index + 1, title: next.session.session_title ?? null },
        ]
      }),
    ),
  // lib/session-refs.ts sessionFacts: how a space post names and dates a session (keys are
  // session IDs, which the move changes, so the facts are kept in session order).
  'space.sessionFacts': async (l) =>
    Object.fromEntries(
      docs[l].map((c) => [String(c.id), Object.values(sessionFacts(c)).sort((a, b) => a.n - b.n)]),
    ),
}
// Not recorded: `emails/cards.ts` and `lib/mentions.ts` show no course time today
// (their dates are events'); `space/session-options.ts` formats `sessionFacts` through
// next-intl's request context, which a script has no way to give.

console.error('Entry points…')
for (const [reader, read] of Object.entries(ENTRY_POINTS)) {
  const values = byLocale(() => ({}) as Record<string, unknown>)
  for (const l of LOCALES) values[l] = await read(l)
  const ids = new Set(LOCALES.flatMap((l) => Object.keys(values[l])))
  for (const id of ids) {
    const [en, ar] = LOCALES.map((l) => values[l][id] ?? null)
    // One value when the languages agree; both when they differ.
    put(reader, id, JSON.stringify(en) === JSON.stringify(ar) ? en : { en, ar })
  }
}

/* ----------------------------------------------------------------- write */

const sorted = (r: Readers): Readers =>
  Object.fromEntries(
    Object.keys(r)
      .sort()
      .map((k) => [
        k,
        Object.fromEntries(
          Object.keys(r[k]!)
            .sort((a, b) => Number(a) - Number(b))
            .map((id) => [id, r[k]![id]]),
        ),
      ]),
  )
const snapshot: Snapshot = { label, today: TODAY, courses: meta, readers: sorted(readers) }
const file = fileOf(label)
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, `${JSON.stringify(snapshot, null, 1)}\n`)

const total = Object.values(meta).reduce((n, m) => n + m.newSessions, 0)
console.error(
  `Wrote ${file}: ${courses.length} courses, ${Object.keys(readers).length} readers, ` +
    `${months.size} calendar months; ${archiveDated.size} archive-dated, ${undated.size} undated, ` +
    `${total} new untitled sessions.`,
)
process.exit(0)
