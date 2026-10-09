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

const cairoFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const toUTC = (day: string): Date => new Date(`${day}T00:00:00Z`)

/**
 * The Cairo calendar day a stored date or timestamp falls on, or null when
 * the value is not a real date (`2026-02-30`, `garbage`, an invalid Date).
 * `addDays()` and `weekdayOf()` take days that came out of here.
 */
export const cairoDay = (value: string | Date): string | null => {
  if (typeof value === 'string' && DAY.test(value)) {
    const d = toUTC(value)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const part = (type: string) => cairoFormat.formatToParts(date).find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export const addDays = (day: string, n: number): string => {
  const d = toUTC(day)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const weekdayOf = (day: string): Weekday => BY_JS_DAY[toUTC(day).getUTCDay()]
