import { weekdayOf, type Weekday } from '@/lib/cairo-day'

/**
 * The one place course times are read (ADR 0011, replacing ADR 0002's
 * pattern). Each session stores its own meetings; order, first and last day,
 * weeks, the next meeting and the summary are worked out from them here.
 * Pure: no Payload, no locale. Callers format the data this returns.
 */

/**
 * One time a session meets. `date` is a Cairo calendar day (`YYYY-MM-DD`);
 * the times are Cairo wall-clock `HH:MM`. Both times empty means all day.
 * Wall-clock, not instants, so a change to Egypt's daylight-saving rules
 * never moves a meeting.
 */
export type Meeting = {
  date: string
  start_time?: string | null
  end_time?: string | null
}

/** What this module reads from a session document. */
export type SessionTimes = {
  meetings?: Meeting[] | null
  cancelled?: boolean | null
  // Orders sessions with no meeting; placed sessions sort by time.
  position?: number | null
}

/** A meeting with the session it belongs to: 1-based, in `sessionsInOrder`. */
export type CourseMeeting = Meeting & { session: number; cancelled?: true }

export const isAllDay = (m: Meeting): boolean => !m.start_time && !m.end_time

/** By day, then start time; an all-day meeting comes first on its day. */
export const byWhen = (a: Meeting, b: Meeting): number =>
  a.date.localeCompare(b.date) || (a.start_time ?? '').localeCompare(b.start_time ?? '')

const firstOf = (s: SessionTimes): Meeting | undefined => [...(s.meetings ?? [])].sort(byWhen)[0]

/**
 * Sessions by their first meeting. Sessions with no meeting follow, by
 * `position`. Ties keep the order they came in.
 */
export const sessionsInOrder = <T extends SessionTimes>(sessions: readonly T[]): T[] =>
  sessions
    .map((session, index) => ({ session, index, first: firstOf(session) }))
    .sort((a, b) => {
      if (a.first && b.first) return byWhen(a.first, b.first) || a.index - b.index
      if (a.first || b.first) return a.first ? -1 : 1
      const pa = a.session.position ?? Infinity
      const pb = b.session.position ?? Infinity
      return pa === pb ? a.index - b.index : pa - pb
    })
    .map(({ session }) => session)

/** Every meeting of the sessions, in time order, each with its session's number. */
export const meetingsOf = (sessions: readonly SessionTimes[]): CourseMeeting[] =>
  sessionsInOrder(sessions)
    .flatMap((s, index) =>
      (s.meetings ?? []).map((m): CourseMeeting => ({
        date: m.date,
        start_time: m.start_time || null,
        end_time: m.end_time || null,
        session: index + 1,
        ...(s.cancelled ? { cancelled: true as const } : {}),
      })),
    )
    .sort(byWhen)

type MaybeCancelled = Meeting & { cancelled?: boolean }

const held = <T extends MaybeCancelled>(meetings: readonly T[]): T[] =>
  meetings.filter((m) => !m.cancelled).sort(byWhen)

/** The day of the first meeting that is not cancelled, or null. */
export const firstDay = (meetings: readonly MaybeCancelled[]): string | null =>
  held(meetings)[0]?.date ?? null

/** The day of the last meeting that is not cancelled, or null. */
export const lastDay = (meetings: readonly MaybeCancelled[]): string | null =>
  held(meetings).at(-1)?.date ?? null

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * The 7-day period a day falls in, counted from `first`: 0 for `first` and
 * the six days after it. A course's weeks run from its first meeting, not
 * from Saturday: a course that meets Thursday and Saturday from a Thursday
 * meets once a week on each day, while a Saturday-to-Friday week would split
 * each pair. Only the calendar view lays out Saturday weeks (`lib/calendar.ts`).
 */
const periodOf = (first: string, day: string): number => Math.floor(daysBetween(first, day) / 7)

/**
 * How many weeks the meetings span: 7-day periods from the first meeting not
 * cancelled to the last one. Zero with no meeting.
 */
export const weeks = (meetings: readonly MaybeCancelled[]): number => {
  const first = firstDay(meetings)
  const last = lastDay(meetings)
  return first && last ? periodOf(first, last) + 1 : 0
}

/** The first meeting not cancelled on or after `today` (a Cairo day), or null. */
export const nextMeeting = <T extends MaybeCancelled>(
  meetings: readonly T[],
  today: string,
): T | null => held(meetings).find((m) => m.date >= today) ?? null

/** A weekly time: the weekday and the Cairo times, null for all day. */
export type WeeklyTime = {
  weekday: Weekday
  start_time: string | null
  end_time: string | null
}

/**
 * What a course page says about when a course meets. `weekly` when every
 * week (`weeks`: 7 days from the first meeting) has the same weekdays and
 * times, the last week perhaps ending early
 * ("Tuesdays and Thursdays, 7–9pm, 8 weeks"); else `dates`, the count of
 * sessions and the first and last day ("12 sessions, 3 March – 28 April").
 * Data, not words: the page formats it in its own language.
 */
export type Summary =
  | { kind: 'weekly'; times: WeeklyTime[]; weeks: number }
  | { kind: 'dates'; sessions: number; first: string; last: string }

const weeklyKey = (m: Meeting) => `${weekdayOf(m.date)} ${m.start_time ?? ''} ${m.end_time ?? ''}`

/**
 * Cancelled meetings are left out. A meeting with no `session` counts as a
 * session of its own, so the same rule serves things that meet with no
 * sessions.
 */
export const summary = (
  meetings: readonly (MaybeCancelled & { session?: number })[],
): Summary | null => {
  const list = held(meetings)
  const first = list[0]
  const last = list.at(-1)
  if (!first || !last) return null

  const span = weeks(list)
  const periods: string[][] = Array.from({ length: span }, () => [])
  for (const m of list) periods[periodOf(first.date, m.date)]!.push(weeklyKey(m))
  const [shape, ...rest] = periods
  // Every week the same weekdays and times; the last may end early, part way
  // through. At least two full weeks, so one week and a short one is no pattern.
  const full = (keys: string[]) => keys.join('|') === shape!.join('|')
  const ending = rest.at(-1) ?? []
  const regular =
    rest.slice(0, -1).every(full) &&
    ending.every((key, i) => key === shape![i]) &&
    periods.filter(full).length >= 2

  if (regular) {
    const firstWeek = list.filter((m) => periodOf(first.date, m.date) === 0)
    return {
      kind: 'weekly',
      times: firstWeek.map((m) => ({
        weekday: weekdayOf(m.date),
        start_time: m.start_time || null,
        end_time: m.end_time || null,
      })),
      weeks: span,
    }
  }

  const sessions = new Set(list.map((m, i) => m.session ?? `meeting ${i}`)).size
  return { kind: 'dates', sessions, first: first.date, last: last.date }
}

/**
 * A course's length in weeks from its stored `first_day` and `last_day`
 * (kept by `lib/course-days.ts` from its meetings), for lists that do not
 * read sessions. Zero when it has no meeting held.
 */
export const storedWeeks = (course: {
  first_day?: string | null
  last_day?: string | null
}): number =>
  course.first_day && course.last_day
    ? weeks([{ date: course.first_day }, { date: course.last_day }])
    : 0

/**
 * A session in its course's order. `number` counts from 1 and counts
 * cancelled sessions too, so a cancelled session keeps its place. `meetings`
 * are its own, in time order. `day` is its first meeting not cancelled
 * (else its first): the day the syllabus and a space post show for it.
 */
export type NumberedSession<T> = {
  session: T
  number: number
  meetings: CourseMeeting[]
  day: string | null
}

/** The course's sessions in order, each with its number, meetings and day. */
export const numberedSessions = <T extends SessionTimes>(
  sessions: readonly T[],
): NumberedSession<T>[] => {
  const meetings = meetingsOf(sessions)
  return sessionsInOrder(sessions).map((session, index) => {
    const own = meetings.filter((m) => m.session === index + 1)
    return {
      session,
      number: index + 1,
      meetings: own,
      day: (own.find((m) => !m.cancelled) ?? own[0])?.date ?? null,
    }
  })
}

/**
 * The session the course meets for next: the one with the first meeting not
 * cancelled on or after `today` (a Cairo day). Null after the last one.
 */
export const upcomingSession = <T>(
  sessions: readonly NumberedSession<T>[],
  today: string,
): NumberedSession<T> | null => {
  const next = nextMeeting(
    sessions.flatMap((s) => s.meetings),
    today,
  )
  return next ? (sessions.find((s) => s.number === next.session) ?? null) : null
}

/**
 * A meeting's stable name within what it belongs to (`owner`, e.g. a
 * session ID): its day and start time. It stays the same when other meetings
 * are added or moved, so a calendar app updates the entry, not a copy.
 */
export const meetingKey = (owner: string | number, m: Meeting): string =>
  `${owner}-${m.date}-${m.start_time ? m.start_time.replace(':', '') : 'day'}`
