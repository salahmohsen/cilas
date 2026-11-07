import type { CalendarItem } from '@/api/calendar.api'
import { addDays, cairoDay, weekdayOf, WEEKDAYS } from '@/lib/cairo-day'
import { POSTER_COLORS } from '@/lib/poster-colors'

/**
 * The calendar page's dates: which days a month, week or agenda shows.
 * Days are `YYYY-MM-DD` Cairo days (see cairo-day.ts); weeks start on
 * Saturday, as Egypt's do.
 */

export const CALENDAR_VIEWS = ['month', 'week', 'agenda'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

/** How many days the agenda lists from its date. */
const AGENDA_DAYS = 30

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
export const weekDays = (day: string): string[] =>
  Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i))

/** The view and day a calendar URL asks for; anything unreadable falls back. */
export const readCalendarParams = (
  params: { view?: string | string[]; date?: string | string[] },
  today: string,
): { view: CalendarView; date: string } => {
  const view =
    typeof params.view === 'string' && (CALENDAR_VIEWS as readonly string[]).includes(params.view)
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
    return {
      from: grid[0],
      to: grid.at(-1)!,
      previous: shiftMonth(monthStart(date), -1),
      next: shiftMonth(monthStart(date), 1),
    }
  }
  if (view === 'week') {
    const days = weekDays(date)
    return { from: days[0], to: days[6], previous: addDays(days[0], -7), next: addDays(days[0], 7) }
  }
  return {
    from: date,
    to: addDays(date, AGENDA_DAYS - 1),
    previous: addDays(date, -AGENDA_DAYS),
    next: addDays(date, AGENDA_DAYS),
  }
}

/** How many courses a month's day cell lists under its image; the rest are "+N more". */
const DAY_LISTED = 2
/** How many covers a day turns through. */
const DAY_COVERS_MAX = 6

/**
 * What a month's day cell shows of its items: the covers of the day's
 * meetings (each picture once, none for a cancelled meeting), the first
 * few items to list by name, and how many are left out.
 */
export const summariseDay = (items: CalendarItem[]) => {
  const covers: NonNullable<CalendarItem['cover']>[] = []
  for (const item of items) {
    if (item.cancelled || !item.cover || covers.length === DAY_COVERS_MAX) continue
    if (!covers.some((c) => c.url === item.cover!.url)) covers.push(item.cover)
  }
  return {
    covers,
    listed: items.slice(0, DAY_LISTED),
    hidden: Math.max(0, items.length - DAY_LISTED),
  }
}

const [YELLOW, BLUE, PINK, GREEN] = POSTER_COLORS as unknown as [string, string, string, string]

/**
 * One poster colour per kind of course or event, so a day reads by colour at
 * a glance: the programme's own courses (core, thematic, lab), the short
 * formats, and events grouped by what they are (talks, arts, visits).
 */
const TYPE_TONES: Record<string, string> = {
  core: YELLOW,
  thematic: BLUE,
  lab: GREEN,
  workshop: PINK,
  short: PINK,
  talk: BLUE,
  panel: BLUE,
  book_discussion: BLUE,
  reading_group: BLUE,
  screening: YELLOW,
  performance: YELLOW,
  music: YELLOW,
  exhibition: YELLOW,
  open_day: GREEN,
  residency: GREEN,
  visit: GREEN,
}

/** Every known type, courses first, in the order a legend lists them. */
export const TYPE_ORDER = Object.keys(TYPE_TONES)

/** The colour of an item's type; a type with none yet falls back to a neutral rule. */
export const toneOf = (item: Pick<CalendarItem, 'type'>): string =>
  TYPE_TONES[item.type] ?? 'var(--border-strong, var(--border))'
