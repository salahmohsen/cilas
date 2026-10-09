import { addDays, cairoDay, WEEKDAYS, weekdayOf, type Weekday } from '@/lib/cairo-day'

/**
 * The one place dates come from (ADR 0002). Every date shown anywhere, from
 * the course page to the calendar, goes through `expandSchedule()`.
 */

export type Slot = {
  weekday: Weekday
  start_time: string
  end_time: string
  label?: string | null
}

export type Schedule = {
  start_date?: string | null
  start_precision?: 'day' | 'week' | null
  weeks?: number | null
  slots?: Slot[] | null
}

export type Meeting = {
  date: string
  start_time: string
  end_time: string
  label?: string
  // 1-based, by session order. Absent for meetings after the last session.
  session?: number
  cancelled?: boolean
}

/** The parts of a course session that affect its dates. */
export type SessionDates = {
  order?: number | null
  // How many pattern meetings this session takes. Default: slots per week.
  meetings?: number | null
  cancelled?: boolean | null
  // When set, these replace the session's computed meetings.
  dates?: Array<{ date: string; start_time: string; end_time: string }> | null
}

const byWhen = (a: Meeting, b: Meeting): number =>
  a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)

// Days from `from` forward to the next `weekday`, 0 when it is that day.
const daysUntil = (from: string, weekday: Weekday): number =>
  (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(weekdayOf(from)) + 7) % 7

const expandPattern = (schedule: Schedule): Meeting[] => {
  const { start_date, weeks, slots } = schedule
  if (!start_date || !weeks || !slots?.length) return []

  const start = cairoDay(start_date)
  const meetings: Meeting[] = []
  for (let week = 0; week < weeks; week++) {
    for (const { weekday, start_time, end_time, label } of slots) {
      meetings.push({
        date: addDays(start, week * 7 + daysUntil(start, weekday)),
        start_time,
        end_time,
        ...(label ? { label } : {}),
      })
    }
  }
  return meetings.sort(byWhen)
}

const inOrder = (sessions: SessionDates[]): SessionDates[] =>
  sessions
    .map((session, index) => ({ session, key: session.order ?? index }))
    .sort((a, b) => a.key - b.key)
    .map(({ session }) => session)

/**
 * Meetings for a schedule. With sessions, each session takes its share of
 * the pattern in order; a cancelled one keeps its share (marked), and one
 * with its own dates swaps its share for them.
 */
export const expandSchedule = (
  schedule: Schedule | null | undefined,
  sessions?: SessionDates[] | null,
): Meeting[] => {
  const pattern = schedule ? expandPattern(schedule) : []
  if (!sessions?.length) return pattern

  const perWeek = schedule?.slots?.length || 1
  const meetings: Meeting[] = []
  let cursor = 0

  inOrder(sessions).forEach((s, index) => {
    const session = index + 1
    const share = pattern.slice(cursor, cursor + (s.meetings ?? perWeek))
    cursor += s.meetings ?? perWeek

    const own = s.dates?.length
      ? s.dates.map(({ date, start_time, end_time }) => ({
          date: cairoDay(date),
          start_time,
          end_time,
        }))
      : share

    for (const meeting of own) {
      meetings.push({ ...meeting, session, ...(s.cancelled ? { cancelled: true } : {}) })
    }
  })

  meetings.push(...pattern.slice(cursor))
  return meetings.sort(byWhen)
}
