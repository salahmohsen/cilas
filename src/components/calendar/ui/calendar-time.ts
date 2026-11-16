import { CAIRO } from '@/lib/cairo-day'
import { numberingSystemOf } from '@/lib/digits'

import { Temporal } from './temporal'

/**
 * The calendar's only date and time code. Days are `YYYY-MM-DD` and times
 * `HH:MM`, as in the item contract; both are Cairo wall-clock. Arithmetic runs
 * on `PlainDate` and `PlainTime`, which have no zone to shift a day. A zone
 * enters only for "now", which is read in `Africa/Cairo`.
 */

const SATURDAY = 6

/** Weeks start on Saturday. */
export const weekStartOf = (day: string): string => {
  const date = Temporal.PlainDate.from(day)
  return date.subtract({ days: (date.dayOfWeek - SATURDAY + 7) % 7 }).toString()
}

export const addDays = (day: string, days: number): string =>
  Temporal.PlainDate.from(day).add({ days }).toString()

/** The same day `months` months on, or the month's last day when it is shorter. */
export const addMonths = (day: string, months: number): string =>
  Temporal.PlainDate.from(day).add({ months }).toString()

/** Every day of the month that holds `day`. */
export const monthOf = (day: string): string[] => {
  const first = Temporal.PlainDate.from(day).with({ day: 1 })
  return Array.from({ length: first.daysInMonth }, (_, index) =>
    first.add({ days: index }).toString(),
  )
}

/** The weeks from Saturday that hold the days of `day`'s month: four to six rows of seven days. */
export const monthWeeksOf = (day: string): string[][] => {
  const days = monthOf(day)
  const weeks: string[][] = []
  for (let start = weekStartOf(days[0]!); start <= days.at(-1)!; start = addDays(start, 7))
    weeks.push(weekOf(start))
  return weeks
}

export const weekOf = (start: string): string[] =>
  Array.from({ length: 7 }, (_, index) => addDays(start, index))

export const toMinutes = (time: string): number => {
  const { hour, minute } = Temporal.PlainTime.from(time)
  return hour * 60 + minute
}

export const toTime = (minutes: number): string =>
  Temporal.PlainTime.from(
    { hour: Math.floor(minutes / 60), minute: minutes % 60 },
    { overflow: 'reject' },
  ).toString({ smallestUnit: 'minute' })

/**
 * The Cairo day and the minutes since midnight on the Cairo clock at an
 * instant (now by default). Read from `Date.now()`, so fake timers move it.
 * The minutes are wall-clock: on the night the clock repeats an hour, the same
 * minutes come twice, and on the night it skips one they jump.
 */
export const cairoNow = (
  instant = Temporal.Instant.fromEpochMilliseconds(Date.now()),
): { date: string; minutes: number } => {
  const now = instant.toZonedDateTimeISO(CAIRO)
  return { date: now.toPlainDate().toString(), minutes: now.hour * 60 + now.minute }
}

const withDigits = <Options extends Intl.DateTimeFormatOptions | Intl.NumberFormatOptions>(
  locale: string,
  options: Options,
) => ({
  ...options,
  numberingSystem: numberingSystemOf(locale),
})

export const formatDay = (day: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  Temporal.PlainDate.from(day).toLocaleString(locale, withDigits(locale, options))

/** Friday, the one weekend day the grid shades. Saturday is a busy teaching day. */
export const isWeekend = (day: string): boolean => Temporal.PlainDate.from(day).dayOfWeek === 5

const clockParts = (minutes: number, locale: string) =>
  new Intl.DateTimeFormat(
    locale,
    withDigits(locale, {
      hour: 'numeric',
      minute: minutes % 60 ? '2-digit' : undefined,
      hourCycle: 'h12',
      timeZone: 'UTC',
    }),
  )
    .formatToParts(Date.UTC(1970, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60))
    // Engines differ in the space before AM and PM; one plain space keeps server and browser equal.
    .map((part) => ({ ...part, value: part.value.replace(/\s/g, ' ') }))

const join = (parts: { value: string }[]) =>
  parts
    .map((part) => part.value)
    .join('')
    .trim()

/**
 * The calendar's one time format: 12 hours, with minutes only when they are
 * not :00. "7 PM", "7:15 PM"; Arabic pages "٧ م" in their own digits.
 */
export const formatTime = (minutes: number, locale: string): string =>
  join(clockParts(minutes, locale))

/** The clock alone, for a block too narrow for more: "10:30", "7". The hour labels beside it say AM or PM. */
export const formatClock = (minutes: number, locale: string): string =>
  join(clockParts(minutes, locale).filter((part) => part.type !== 'dayPeriod'))

/**
 * The shortest start time, for a month's chips: "10a", "7:30p"; Arabic keeps
 * its own word, "١٠ ص". A Latin AM or PM shrinks to its first letter.
 */
export const formatShortTime = (minutes: number, locale: string): string =>
  join(
    clockParts(minutes, locale).map((part) =>
      part.type === 'dayPeriod' && /^[AP]\.?M\.?$/i.test(part.value)
        ? { ...part, value: part.value[0]!.toLowerCase() }
        : part,
    ),
  ).replace(/(\d) ([ap])$/, '$1$2')

/** A start and an end that share AM or PM say it once: "10:30 – 11:30 AM", "11 AM – 12:30 PM". */
export const formatTimeRange = (start: number, end: number, locale: string): string => {
  const from = clockParts(start, locale)
  const to = clockParts(end, locale)
  const period = (parts: typeof from) => parts.find((part) => part.type === 'dayPeriod')?.value
  const shared = period(from) === period(to)
  return `${join(shared ? from.filter((part) => part.type !== 'dayPeriod') : from)} – ${join(to)}`
}

/** The month and year of a run of days: "November 2026", or "November – December 2026" across two. */
export const formatMonths = (from: string, to: string, locale: string): string => {
  const utc = (day: string) => {
    const date = Temporal.PlainDate.from(day)
    return Date.UTC(date.year, date.month - 1, date.day)
  }
  return new Intl.DateTimeFormat(
    locale,
    withDigits(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  )
    .formatRange(utc(from), utc(to))
    .replace(/\s/g, ' ')
}

/**
 * How long a block lasts: "5 hr 35 min", "45 min". Arabic spells the units
 * out ("٥ ساعات و٣٥ دقيقة"), since its short forms are single letters.
 */
export const formatLength = (minutes: number, locale: string): string => {
  const unitDisplay = locale === 'ar' ? 'long' : 'short'
  const unit = (value: number, name: 'hour' | 'minute') =>
    new Intl.NumberFormat(
      locale,
      withDigits(locale, { style: 'unit', unit: name, unitDisplay }),
    ).format(value)
  const parts = [
    ...(minutes >= 60 ? [unit(Math.floor(minutes / 60), 'hour')] : []),
    ...(minutes % 60 || minutes < 60 ? [unit(minutes % 60, 'minute')] : []),
  ]
  return new Intl.ListFormat(locale, { type: 'unit', style: 'narrow' }).format(parts)
}
