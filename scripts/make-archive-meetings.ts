/**
 * ADR 0011, "Archive courses get approximate meetings": gives every course
 * with no meeting the meetings its old timing says (`archive-meetings-plan.ts`
 * holds the rules), before the fields that held that timing are dropped.
 *
 *   pnpm tsx scripts/make-archive-meetings.ts --dry-run    counts per group, no write
 *   pnpm tsx scripts/make-archive-meetings.ts              writes
 *
 * Reads the old, frozen `schedule` group with SQL (start date, weeks, weekly
 * slots), the research file's term starts and the cycle's start date. A
 * course with a meeting is skipped, so a second run changes nothing; run it
 * after `migrate-course-sessions.ts`. Each course is written in one transaction, through
 * the sessions collection, so its first and last day, caches and search
 * follow.
 */
import { readFileSync } from 'node:fs'
import { createLocalReq, getPayload } from 'payload'

import { cairoDay } from '../src/lib/cairo-day'
import { inTransaction } from '../src/lib/in-transaction'
import { sessionsInOrder, type WeeklyTime } from '../src/lib/meetings'
import config from '../src/payload.config'
import { planArchiveMeetings, type ArchiveGroup, type StartSource } from './archive-meetings-plan'

const RESEARCH = 'docs/research/2026-11-course-start-dates.json'
const apply = !process.argv.includes('--dry-run')

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
const { rows } = await pool.query<Row>(
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

for (const row of rows) {
  const sessions = sessionsOf.get(row.id) ?? []
  const ordered = sessionsInOrder(sessions)
  const plan = planArchiveMeetings({
    hasMeetings: sessions.some((s) => s.meetings?.length),
    startDay: row.schedule_start_day,
    weeks: num(row.schedule_weeks),
    slots: row.slots,
    term: {
      research: research.get(row.id) ?? null,
      cycle: row.cycle_start ? cairoDay(row.cycle_start) : null,
    },
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
