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

const withDigits = (locale: string, options: Intl.DateTimeFormatOptions) => ({
  ...options,
  numberingSystem: numberingSystemOf(locale),
})

export const formatDay = (day: string, locale: string, options: Intl.DateTimeFormatOptions) =>
  Temporal.PlainDate.from(day).toLocaleString(locale, withDigits(locale, options))

export const formatMinutes = (minutes: number, locale: string, hour12: boolean, hourOnly = false) =>
  Temporal.PlainTime.from({
    hour: Math.floor(minutes / 60) % 24,
    minute: minutes % 60,
  }).toLocaleString(
    locale,
    withDigits(locale, {
      hour: hour12 ? 'numeric' : '2-digit',
      minute: hourOnly && hour12 ? undefined : '2-digit',
      hourCycle: hour12 ? 'h12' : 'h23',
    }),
  )
