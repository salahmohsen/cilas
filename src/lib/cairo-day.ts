/**
 * Calendar days as `YYYY-MM-DD` strings. CILAS times are Cairo wall-clock
 * (ADR 0002), so day arithmetic runs on plain dates in UTC, where no
 * daylight-saving shift can move a day.
 */

export const CAIRO = 'Africa/Cairo'

// Egypt's week starts on Saturday, so admin dropdowns list it first.
export const WEEKDAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const
export type Weekday = (typeof WEEKDAYS)[number]

// Indexed by Date#getUTCDay(), where 0 is Sunday.
const BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DAY = /^\d{4}-\d{2}-\d{2}$/

const cairoFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** The Cairo calendar day a stored date or timestamp falls on. */
export const cairoDay = (value: string | Date): string =>
  typeof value === 'string' && DAY.test(value) ? value : cairoFormat.format(new Date(value))

const toUTC = (day: string): Date => new Date(`${day}T00:00:00Z`)

export const addDays = (day: string, n: number): string => {
  const d = toUTC(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const weekdayOf = (day: string): Weekday => BY_JS_DAY[toUTC(day).getUTCDay()]
