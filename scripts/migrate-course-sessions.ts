/**
 * ADR 0011, migration step 2: fills the sessions collection from every
 * course's old schedule and sessions array. The rules live in
 * `course-sessions-plan.ts`; this loads, calls them and writes.
 *
 *   pnpm tsx scripts/migrate-course-sessions.ts              dry run: counts only
 *   pnpm tsx scripts/migrate-course-sessions.ts --apply      writes
 *   ... --map path/to/map.json                               default ./course-sessions-map.json
 *   ... --refill 4,5,6 (or a file of IDs)                    delete and plan these again
 *
 * A published course with a newer pending draft is filled from the draft
 * (`fillSource`). Safe to run twice: a course that already has sessions is
 * skipped, the map (old row ID → new session ID, for the space posts step) is
 * read back and only added to, and the timing notes are set, not appended.
`--refill` deletes the named courses' sessions and fills them again, after
their old schedule changed (`apply-archive-start-dates.ts`); it stops before
any write when a space post names one of those sessions, by its old row ID
or its new ID.
 * Each course is written in one transaction. Then
 * `scripts/verify-course-sessions.ts` checks the result.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createLocalReq, getPayload } from 'payload'

import { sessionIdsIn } from '../src/lib/session-refs'
import config from '../src/payload.config'
import { inTransaction } from '../src/plugins/mcp/transaction'
import {
  planCourseSessions,
  type Locale,
  type Localized,
  type PlannedSession,
} from './course-sessions-plan'
import { lexicalToMarkdown } from './course-sessions-markdown'
import { loadCourseSources } from './course-sessions-source'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? undefined : process.argv[i + 1]
}
const apply = process.argv.includes('--apply')
const mapPath = resolve(arg('--map') ?? 'course-sessions-map.json')
const refillArg = arg('--refill')
const refill = new Set(
  (refillArg && existsSync(refillArg) ? readFileSync(refillArg, 'utf8') : (refillArg ?? ''))
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number),
)
if ([...refill].some((id) => !Number.isInteger(id))) throw new Error(`--refill: ${refillArg}`)

const payload = await getPayload({ config })
const toMarkdown = await lexicalToMarkdown(payload)

type Row = Record<string, unknown> & { id?: string }

const pick = <T>(value: Localized<T>, locale: Locale): T | null => value?.[locale] ?? null

/** A planned session's data in one language, array rows keeping their IDs. */
const inLocale = (s: PlannedSession, locale: Locale) => ({
  title: pick(s.title, locale),
  description: pick(s.description, locale),
  bibliography: (s.bibliography as Row[]).map((r) => ({
    ...r,
    title: pick(r.title as Localized<string>, locale),
    note: pick(r.note as Localized<string>, locale),
  })),
  activities: (s.activities as Row[]).map((r) => ({
    ...r,
    description: pick(r.description as Localized<string>, locale),
  })),
})

const hasArabic = (s: PlannedSession) =>
  JSON.stringify(inLocale(s, 'ar')) !==
  JSON.stringify({ title: null, description: null, bibliography: [], activities: [] })

const map: Record<string, number> = existsSync(mapPath)
  ? JSON.parse(readFileSync(mapPath, 'utf8'))
  : {}
const saveMap = () => {
  writeFileSync(`${mapPath}.tmp`, `${JSON.stringify(map, null, 2)}\n`)
  renameSync(`${mapPath}.tmp`, mapPath)
}

const counts = {
  courses: 0,
  skipped: 0,
  refilled: 0,
  deleted: 0,
  sessions: 0,
  untitled: 0,
  startDays: 0,
  timesInNote: 0,
  fromDrafts: [] as number[],
}
const problems: string[] = []

/**
 * The timing note on the course row and on its latest version, so a later
 * publish of a pending draft keeps it. A language with a note gets a row if
 * it has none; an empty note makes no row.
 */
const storeTimingNote = async (course: number, version: number | null, note: Localized<string>) => {
  const targets = [
    { table: 'courses_locales', column: 'timing_note', parent: course },
    ...(version === null
      ? []
      : [{ table: '_courses_v_locales', column: 'version_timing_note', parent: version }]),
  ]
  for (const locale of ['en', 'ar'] as const)
    for (const { table, column, parent } of targets) {
      const text = note?.[locale] ?? null
      await payload.db.pool.query(
        text === null
          ? `UPDATE ${table} SET ${column} = $3 WHERE _locale = $1 AND _parent_id = $2`
          : `INSERT INTO ${table} (_locale, _parent_id, ${column}) VALUES ($1, $2, $3)
               ON CONFLICT (_locale, _parent_id) DO UPDATE SET ${column} = EXCLUDED.${column}`,
        [locale, parent, text],
      )
    }
}

/**
 * The refilled courses' sessions, by course. Stops when a space post names
 * one: its old row ID (`course_session`, the body tokens today) or its new
 * ID (after the space posts step) would point at nothing.
 */
const toRefill = async (): Promise<Map<number, number[]>> => {
  const out = new Map<number, number[]>()
  if (!refill.size) return out
  const { docs } = await payload.find({
    collection: 'sessions',
    where: { course: { in: [...refill] } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { course: true },
  })
  for (const doc of docs) {
    const course = Number(typeof doc.course === 'object' ? doc.course?.id : doc.course)
    out.set(course, [...(out.get(course) ?? []), doc.id])
  }
  const ids = new Set(docs.map((d) => String(d.id)))
  for (const [from, id] of Object.entries(map)) if (ids.has(String(id))) ids.add(from)
  const { rows } = await payload.db.pool.query<{
    id: number
    course_session: string | null
    body: string | null
  }>(
    `SELECT id, course_session, body FROM space_posts
      WHERE course_session IS NOT NULL OR body ~ '(session:|::session\\[)'`,
  )
  const named = rows.filter(
    (r) =>
      (r.course_session && ids.has(r.course_session)) ||
      sessionIdsIn(r.body ?? '').some((id) => ids.has(id)),
  )
  if (named.length) {
    console.error(
      `Stopped: space posts ${named.map((r) => r.id).join(', ')} name sessions of a course to refill.`,
    )
    process.exit(1)
  }
  return out
}
const refilling = await toRefill()

// Each older version's timing note is its own schedule note, so restoring it
// keeps its words. The latest version and the course row follow the plan.
if (apply)
  await payload.db.pool.query(
    `UPDATE _courses_v_locales SET version_timing_note = version_schedule_note
       WHERE version_timing_note IS DISTINCT FROM version_schedule_note`,
  )

for (const { course, source, latest, fromDraft } of await loadCourseSources(payload)) {
  const plan = planCourseSessions(source, toMarkdown)
  if (fromDraft) counts.fromDrafts.push(course.id)
  if (JSON.stringify(plan.timingNote) !== JSON.stringify(source.schedule?.note ?? null))
    counts.timesInNote++
  if (apply) await storeTimingNote(course.id, latest?.id ?? null, plan.timingNote)
  const { totalDocs: existing } = await payload.count({
    collection: 'sessions',
    where: { course: { equals: course.id } },
    overrideAccess: true,
  })
  const replaced = refilling.get(course.id) ?? []
  if (existing > 0 && !replaced.length) {
    counts.skipped++
    const unmapped = plan.sessions.filter((s) => s.from && !(s.from in map))
    if (existing !== plan.sessions.length || unmapped.length)
      problems.push(
        `Course ${course.id}: has ${existing} sessions, expected ${plan.sessions.length}; ${unmapped.length} old rows missing from the map.`,
      )
    continue
  }

  counts.courses++
  if (replaced.length) counts.refilled++
  counts.deleted += replaced.length
  counts.sessions += plan.sessions.length
  counts.untitled += plan.sessions.filter((s) => !s.from).length
  if (plan.startDay) counts.startDays++
  if (!apply || (!plan.sessions.length && !replaced.length)) continue

  const req = await createLocalReq({}, payload)
  const made = await inTransaction(req, async () => {
    if (replaced.length)
      await payload.delete({
        collection: 'sessions',
        where: { id: { in: replaced } },
        overrideAccess: true,
        req,
      })
    const ids: Array<[string | null, number]> = []
    for (const s of plan.sessions) {
      const common = {
        course: course.id,
        delivery: s.delivery,
        cancelled: s.cancelled,
        meetings: s.meetings,
        position: s.position,
      }
      const doc = await payload.create({
        collection: 'sessions',
        locale: 'en',
        data: { ...common, ...inLocale(s, 'en') } as never,
        overrideAccess: true,
        req,
      })
      if (hasArabic(s))
        await payload.update({
          collection: 'sessions',
          id: doc.id,
          locale: 'ar',
          data: inLocale(s, 'ar') as never,
          overrideAccess: true,
          req,
        })
      ids.push([s.from, doc.id])
    }
    return ids
  })
  const gone = new Set(replaced)
  for (const [from, id] of Object.entries(map)) if (gone.has(id)) delete map[from]
  for (const [from, id] of made) if (from) map[from] = id
  saveMap()
}

console.log(JSON.stringify({ apply, map: mapPath, ...counts, problems }, null, 2))
process.exit(problems.length ? 1 : 0)
