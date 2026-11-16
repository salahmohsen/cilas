import { cairoDay } from '@/lib/cairo-day'

import { ALL_VIEWS, daysShown, type CalendarView } from './ui/calendar-views'

/**
 * The public calendar's place in its URL: `?view=week&date=2026-03-07`.
 * Old links (`month`, `week`, `agenda`) still open their view; `3days` is
 * the phone's three days. Anything unreadable falls back to the month of today.
 */
const URL_VIEWS: Record<string, CalendarView> = {
  month: 'month',
  week: 'week',
  day: 'day',
  '3days': 'threeDays',
  agenda: 'agenda',
}

const urlName = (view: CalendarView) =>
  Object.keys(URL_VIEWS).find((name) => URL_VIEWS[name] === view)!

type Params = { view?: string | string[] | null; date?: string | string[] | null }

/** The view and day a calendar URL asks for. */
export const readCalendarUrl = (
  params: Params,
  today: string,
): { view: CalendarView; day: string } => {
  const view = typeof params.view === 'string' ? URL_VIEWS[params.view] : undefined
  const day = typeof params.date === 'string' ? cairoDay(params.date) : null
  return { view: view ?? 'month', day: day ?? today }
}

/** The query of a view and day: `?view=3days&date=2026-03-07`. */
export const calendarQuery = (view: CalendarView, day: string) =>
  `?view=${urlName(view)}&date=${day}`

export type DayRange = { from: string; to: string }

const rangeOf = (days: string[]): DayRange => {
  const sorted = days.toSorted()
  return { from: sorted[0]!, to: sorted.at(-1)! }
}

const daysAround = (views: readonly CalendarView[], day: string) =>
  views.flatMap((view) => [true, false].flatMap((narrow) => daysShown(view, day, narrow)))

/** The days `view` at `day` shows, on a phone or a wide screen. */
export const viewDays = (view: CalendarView, day: string): DayRange =>
  rangeOf(daysAround([view], day))

/**
 * The days a page loads for `day`: every view a visitor can switch to there,
 * at any width, so a switch of view needs no new page.
 */
export const loadedRange = (day: string): DayRange => rangeOf(daysAround(ALL_VIEWS, day))

/** Whether `range` holds every day `view` at `day` shows, at either width. */
export const holds = (range: DayRange, view: CalendarView, day: string) => {
  const days = viewDays(view, day)
  return days.from >= range.from && days.to <= range.to
}
