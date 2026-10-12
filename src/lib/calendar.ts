import { addDays, cairoDay, weekdayOf, WEEKDAYS } from '@/lib/cairo-day'

/**
 * The calendar page's dates: which days a month, week or agenda shows.
 * Days are `YYYY-MM-DD` Cairo days (see cairo-day.ts); weeks start on
 * Saturday, as Egypt's do.
 */

export const CALENDAR_VIEWS = ['month', 'week', 'agenda'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

/** How many days the agenda lists from its date. */
export const AGENDA_DAYS = 30

/** The Saturday on or before a day. */
export const weekStart = (day: string): string => addDays(day, -WEEKDAYS.indexOf(weekdayOf(day)))

/** The first day of a day's month. */
export const monthStart = (day: string): string => `${day.slice(0, 8)}01`

/** The same day of another month, clamped to that month's length. */
export const shiftMonth = (day: string, n: number): string => {
  const [y, m] = day.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(Number(day.slice(8, 10)), last))
  return target.toISOString().slice(0, 10)
}

/** The days a month view shows: whole weeks, Saturday to Friday, around the month. */
export const monthGrid = (day: string): string[] => {
  const first = monthStart(day)
  const next = monthStart(shiftMonth(first, 1))
  const days: string[] = []
  for (let d = weekStart(first); d < next || days.length % 7; d = addDays(d, 1)) days.push(d)
  return days
}

/** The seven days of a day's week. */
export const weekDays = (day: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i))

/** The view and day a calendar URL asks for; anything unreadable falls back. */
export const readCalendarParams = (
  params: { view?: string | string[]; date?: string | string[] },
  today: string,
): { view: CalendarView; date: string } => {
  const view = typeof params.view === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(params.view)
  const date = typeof params.date === 'string' ? cairoDay(params.date) : null
  return { view: view ? (params.view as CalendarView) : 'month', date: date ?? today }
}

/** The first and last day a view shows, and the days to step back and forward. */
export const viewRange = (
  view: CalendarView,
  date: string,
): { from: string; to: string; previous: string; next: string } => {
  if (view === 'month') {
    const grid = monthGrid(date)
    return { from: grid[0], to: grid.at(-1)!, previous: shiftMonth(monthStart(date), -1), next: shiftMonth(monthStart(date), 1) }
  }
  if (view === 'week') {
    const days = weekDays(date)
    return { from: days[0], to: days[6], previous: addDays(days[0], -7), next: addDays(days[0], 7) }
  }
  return { from: date, to: addDays(date, AGENDA_DAYS - 1), previous: addDays(date, -AGENDA_DAYS), next: addDays(date, AGENDA_DAYS) }
}
