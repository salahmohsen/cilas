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

export const expandSchedule = (schedule: Schedule | null | undefined): Meeting[] =>
  schedule ? expandPattern(schedule) : []
