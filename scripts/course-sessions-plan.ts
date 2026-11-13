import { cairoDay } from '../src/lib/cairo-day'
import type { Meeting } from '../src/lib/meetings'
import {
  expandSchedule,
  sessionsInOrder,
  type Schedule,
  type SessionDates,
} from '../src/lib/schedule'

/**
 * ADR 0011, migration step 2: what one course's old schedule and sessions
 * array become in the sessions collection. Pure; the fill script loads,
 * calls this and writes, and the verify script calls it to know what to
 * expect. Delete with the old fields.
 */

export type Locale = 'en' | 'ar'
/** A localized value as Payload reads it with `locale: 'all'`. */
export type Localized<T> = Partial<Record<Locale, T | null>> | null | undefined

export type OldRow = SessionDates & {
  id: string
  session_title?: Localized<string>
  description?: Localized<unknown>
  delivery?: 'OFFLINE' | 'ONLINE' | 'HYBRID' | null
  bibliography?: unknown[] | null
  activities?: unknown[] | null
}

export type OldCourse = {
  id: number
  schedule?: Schedule | null
  sessions?: OldRow[] | null
}

export type PlannedSession = {
  /** The old row's ID, or null for a session the pattern needs but no row held. */
  from: string | null
  title: Localized<string>
  description: Localized<string>
  delivery: OldRow['delivery']
  bibliography: unknown[]
  activities: unknown[]
  cancelled: boolean
  meetings: Meeting[]
  position: number
}

export type Plan = {
  sessions: PlannedSession[]
  /** The day of the all-day meeting a course with a start date but no times gets, else null. */
  startDay: string | null
}

const LOCALES: Locale[] = ['en', 'ar']

const mapLocales = <A, B>(value: Localized<A>, f: (a: A) => B | null): Localized<B> => {
  if (!value) return null
  const out: Partial<Record<Locale, B | null>> = {}
  for (const locale of LOCALES) {
    const v = value[locale]
    if (v != null) out[locale] = f(v)
  }
  return out
}

const untitled = (meetings: Meeting[]): Omit<PlannedSession, 'position'> => ({
  from: null,
  title: null,
  description: null,
  delivery: null,
  bibliography: [],
  activities: [],
  cancelled: false,
  meetings,
})

const chunk = <T>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size),
  )

const timesOf = ({ date, start_time, end_time }: Meeting): Meeting => ({
  date,
  start_time,
  end_time,
})

/**
 * - Each old row becomes a session with the same content and the meetings
 *   `expandSchedule` gives it today; the description becomes Markdown.
 * - Pattern meetings no row holds become new untitled sessions, one per week
 *   of slots, today's default share.
 * - Rows with no meeting keep their old order through `position`.
 * - A start date with no meeting at all becomes one all-day meeting on the
 *   first session, or on a new one when there is none.
 */
export const planCourseSessions = (
  course: OldCourse,
  toMarkdown: (lexical: unknown) => string,
): Plan => {
  const schedule = course.schedule ?? null
  if (schedule?.start_precision === 'week')
    throw new Error(`Course ${course.id}: a week-only start date has no place in the new model.`)

  const rows = sessionsInOrder(course.sessions ?? [])
  const meetings = expandSchedule(schedule, rows)

  const fromRows = rows.map((row, i): Omit<PlannedSession, 'position'> => ({
    from: row.id,
    title: mapLocales(row.session_title, (t) => t),
    description: mapLocales(row.description, (lexical) => toMarkdown(lexical).trim() || null),
    delivery: row.delivery ?? null,
    bibliography: row.bibliography ?? [],
    activities: row.activities ?? [],
    cancelled: !!row.cancelled,
    meetings: meetings.filter((m) => m.session === i + 1).map(timesOf),
  }))

  const perWeek = schedule?.slots?.length || 1
  const leftover = meetings.filter((m) => m.session === undefined).map(timesOf)
  const extra = chunk(leftover, perWeek).map(untitled)

  const sessions = [...fromRows, ...extra]
  const start = schedule?.start_date ? cairoDay(schedule.start_date) : null
  const startDay = start && meetings.length === 0 ? start : null
  if (startDay) {
    const allDay: Meeting = { date: startDay, start_time: null, end_time: null }
    if (sessions[0]) sessions[0] = { ...sessions[0], meetings: [allDay] }
    else sessions.push(untitled([allDay]))
  }

  return {
    sessions: sessions.map((s, position) => ({ ...s, position })),
    startDay,
  }
}
