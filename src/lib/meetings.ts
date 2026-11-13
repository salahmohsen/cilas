import { addDays, WEEKDAYS, weekdayOf, type Weekday } from '@/lib/cairo-day'

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

/** The Saturday that starts the Egyptian week a day falls in. */
const weekStart = (day: string): string => addDays(day, -WEEKDAYS.indexOf(weekdayOf(day)))

const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

/**
 * How many calendar weeks (Saturday to Friday) the meetings span, from the
 * first to the last one not cancelled. Zero with no meeting.
 */
export const weeks = (meetings: readonly MaybeCancelled[]): number => {
  const first = firstDay(meetings)
  const last = lastDay(meetings)
  return first && last ? Math.floor(daysBetween(weekStart(first), last) / 7) + 1 : 0
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
 * week from the first to the last meeting has the same weekdays and times
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
  const byWeek = new Map<string, string[]>()
  for (const m of list) {
    const week = weekStart(m.date)
    byWeek.set(week, [...(byWeek.get(week) ?? []), weeklyKey(m)])
  }
  const shapes = new Set([...byWeek.values()].map((keys) => keys.join('|')))

  if (span > 1 && byWeek.size === span && shapes.size === 1) {
    const firstWeek = list.filter((m) => weekStart(m.date) === weekStart(first.date))
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
