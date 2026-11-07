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

const cairoClock = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** Minutes Cairo is ahead of UTC at that instant (120 in winter, 180 in summer). */
const cairoOffset = (instant: number): number => {
  const parts = Object.fromEntries(
    cairoClock.formatToParts(new Date(instant)).map((p) => [p.type, p.value]),
  )
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
  return Math.round((wall - Math.floor(instant / 60_000) * 60_000) / 60_000)
}

/**
 * The instant a Cairo wall-clock day and time name, as an ISO string, or
 * null for a day or time that is not real. The offset is read twice, so a
 * time beside a daylight-saving change lands on the right side of it.
 */
export const cairoInstant = (day: string, time: string): string | null => {
  if (!cairoDay(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  const [h, min] = time.split(':').map(Number) as [number, number]
  const wall = Date.UTC(y, m - 1, d, h, min)
  const first = wall - cairoOffset(wall) * 60_000
  return new Date(wall - cairoOffset(first) * 60_000).toISOString()
}

const cairoHours = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
})

/** The Cairo wall-clock time (`HH:MM`) of an instant, the inverse of `cairoInstant()`'s time. */
export const cairoTime = (value: string | Date): string | null => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const part = (type: string) => cairoHours.formatToParts(date).find((p) => p.type === type)?.value
  return `${part('hour')}:${part('minute')}`
}

export const cairoNoon = (day: string): Date => new Date(`${day}T12:00:00Z`)
