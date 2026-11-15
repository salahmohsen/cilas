/**
 * ADR 0011, "Archive courses get approximate meetings": gives every course
 * with no meeting the meetings its old timing says (`archive-meetings-plan.ts`
 * holds the rules), before the fields that held that timing are dropped.
 *
 *   pnpm tsx scripts/make-archive-meetings.ts --dry-run    counts per group, no write
 *   pnpm tsx scripts/make-archive-meetings.ts              writes
 *   pnpm tsx scripts/make-archive-meetings.ts --mark-approximate [--dry-run]
 *                                                          marks the meetings it made
 *
 * Reads the old, frozen `schedule` group with SQL (start date, weeks, weekly
 * slots), the research file's term starts and the cycle's start date. A
 * course with a meeting is skipped, so a second run changes nothing; run it
 * after `migrate-course-sessions.ts`. Each course is written in one transaction, through
 * the sessions collection, so its first and last day, caches and search
 * follow.
 *
 * `--mark-approximate` (ADR 0011, "Approximate archive meetings get a
 * mark"): the meetings this script made get `approximate`. Those courses have
 * meetings now, so it plans each course again as the first run did: only a
 * course whose old pattern gave no meeting (`patternDated`), with its
 * sessions by `position`. A stored meeting on the planned session, day and
 * times is marked (`matchArchiveMeetings`); one a person has moved since is
 * not; the rest is reported. It writes the flag with SQL on each meeting row
 * and on its session's latest version, since the meetings hook keeps only
 * flags that are stored already. A second run marks nothing.
 */
import { readFileSync } from 'node:fs'
import { createLocalReq, getPayload } from 'payload'

import { cairoDay } from '../src/lib/cairo-day'
import { inTransaction } from '../src/lib/in-transaction'
import { sessionsInOrder, type WeeklyTime } from '../src/lib/meetings'
import config from '../src/payload.config'
import {
  matchArchiveMeetings,
  patternDated,
  planArchiveMeetings,
  type ApproximateMatch,
  type ArchiveGroup,
  type StartSource,
} from './archive-meetings-plan'

const RESEARCH = 'docs/research/2026-11-course-start-dates.json'
const apply = !process.argv.includes('--dry-run')
const mark = process.argv.includes('--mark-approximate')

const research = new Map(
  (JSON.parse(readFileSync(RESEARCH, 'utf8')) as { id: number; start_date: string | null }[]).map(
    (e) => [e.id, e.start_date] as const,
  ),
)

const payload = await getPayload({ config })
const pool = payload.db.pool

type Row = {
  id: number
  schedule_start_day: string | null
  schedule_weeks: string | null
  cycle_start: Date | null
  slots: WeeklyTime[]
}
const { rows: courseRows } = await pool.query<Row>(
  `SELECT c.id, to_char(c.schedule_start_date AT TIME ZONE 'Africa/Cairo', 'YYYY-MM-DD') AS schedule_start_day,
          c.schedule_weeks,
          cy.start_date AS cycle_start,
          COALESCE((SELECT json_agg(json_build_object(
                      'weekday', s.weekday, 'start_time', s.start_time, 'end_time', s.end_time)
                    ORDER BY s._order)
                      FROM courses_schedule_slots s WHERE s._parent_id = c.id), '[]') AS slots
     FROM courses c LEFT JOIN cycles cy ON cy.id = c.cycle_id
    ORDER BY c.id`,
)

const { docs: sessionDocs } = await payload.find({
  collection: 'sessions',
  depth: 0,
  pagination: false,
  overrideAccess: true,
  select: { course: true, meetings: true, position: true, cancelled: true },
})
const sessionsOf = new Map<number, typeof sessionDocs>()
for (const doc of sessionDocs) {
  const course = typeof doc.course === 'object' ? doc.course.id : doc.course
  sessionsOf.set(course, [...(sessionsOf.get(course) ?? []), doc])
}

const num = (v: string | null) => (v === null ? null : Number(v))
const termOf = (row: Row) => ({
  research: research.get(row.id) ?? null,
  cycle: row.cycle_start ? cairoDay(row.cycle_start) : null,
})

if (mark) await markApproximate()

async function markApproximate() {
  // The old pattern as the fill read it: the course's `schedule` and old sessions array.
  const { docs: old } = await payload.find({
    collection: 'courses',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { schedule: true, sessions: true },
  })
  const dated = new Set(old.filter((c) => patternDated(c.schedule, c.sessions)).map((c) => c.id))

  const report = {
    apply,
    courses: 0,
    groups: {} as Partial<Record<ArchiveGroup, { courses: number; meetings: number }>>,
    planned: 0,
    marked: 0,
    markedBefore: 0,
    missing: [] as ({ course: number } & ApproximateMatch['missing'][number])[],
    other: [] as ({ course: number } & ApproximateMatch['other'][number])[],
  }
  const toMark: string[] = []
  for (const row of courseRows) {
    if (dated.has(row.id)) continue
    const sessions = [...(sessionsOf.get(row.id) ?? [])].sort(
      (a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.id - b.id,
    )
    const plan = planArchiveMeetings({
      hasMeetings: false,
      startDay: row.schedule_start_day,
      weeks: num(row.schedule_weeks),
      slots: row.slots,
      term: termOf(row),
      sessions: sessions.map((s) => s.id),
    })
    const planned =
      plan.onSessions.flatMap((s) => s.meetings).length + plan.newSessions.flat().length
    if (!planned) continue
    const match = matchArchiveMeetings(
      plan,
      sessions.map((s) => ({
        id: s.id,
        meetings: (s.meetings ?? []).map((m) => ({ ...m, id: String(m.id) })),
      })),
    )
    const group = (report.groups[plan.group] ??= { courses: 0, meetings: 0 })
    group.courses++
    group.meetings += match.mark.length + match.marked
    report.courses++
    report.planned += planned
    report.marked += match.mark.length
    report.markedBefore += match.marked
    report.missing.push(...match.missing.map((m) => ({ course: row.id, ...m })))
    report.other.push(...match.other.map((m) => ({ course: row.id, ...m })))
    toMark.push(...match.mark)
  }

  if (apply && toMark.length) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('UPDATE sessions_meetings SET approximate = true WHERE id = ANY($1)', [
        toMark,
      ])
      // The same rows in each session's latest version, so its history shows the flag.
      await client.query(
        `UPDATE _sessions_v_version_meetings vm SET approximate = true
           FROM (SELECT DISTINCT ON (parent_id) id FROM _sessions_v
                  ORDER BY parent_id, created_at DESC, id DESC) latest
          WHERE vm._parent_id = latest.id AND vm._uuid = ANY($1)`,
        [toMark],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}
const counts = {
  apply,
  groups: {} as Record<ArchiveGroup, number>,
  sources: {} as Partial<Record<StartSource, number>>,
  meetingsMade: 0,
  sessionsUpdated: 0,
  sessionsMade: 0,
  timesLost: [] as number[],
  weeksLost: [] as number[],
}
const bump = <K extends string>(record: Partial<Record<K, number>>, key: K) => {
  record[key] = (record[key] ?? 0) + 1
}

for (const row of courseRows) {
  const sessions = sessionsOf.get(row.id) ?? []
  const ordered = sessionsInOrder(sessions)
  const plan = planArchiveMeetings({
    hasMeetings: sessions.some((s) => s.meetings?.length),
    startDay: row.schedule_start_day,
    weeks: num(row.schedule_weeks),
    slots: row.slots,
    term: termOf(row),
    sessions: ordered.map((s) => s.id),
  })
  bump(counts.groups, plan.group)
  if (plan.startedFrom) bump(counts.sources, plan.startedFrom.source)
  if (plan.group === 'times-lost') counts.timesLost.push(row.id)
  if (plan.group === 'weeks-lost') counts.weeksLost.push(row.id)
  const made = plan.onSessions.flatMap((s) => s.meetings).length
  counts.meetingsMade += made + plan.newSessions.flat().length
  counts.sessionsUpdated += plan.onSessions.length
  counts.sessionsMade += plan.newSessions.length
  if (!apply || (!plan.onSessions.length && !plan.newSessions.length)) continue

  const nextPosition = Math.max(-1, ...sessions.map((s) => s.position ?? -1)) + 1
  const req = await createLocalReq({}, payload)
  await inTransaction(req, async () => {
    for (const { session, meetings } of plan.onSessions)
      await payload.update({
        collection: 'sessions',
        id: session,
        data: { meetings },
        overrideAccess: true,
        req,
      })
    for (const [i, meetings] of plan.newSessions.entries())
      await payload.create({
        collection: 'sessions',
        locale: 'en',
        data: { course: row.id, meetings, position: nextPosition + i, cancelled: false },
        overrideAccess: true,
        req,
      })
  })
}

console.log(JSON.stringify(counts, null, 2))
process.exit(0)
