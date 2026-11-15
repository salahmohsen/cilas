import { addDays, WEEKDAYS, type Weekday } from '@/lib/cairo-day'
import { numberingSystemOf } from '@/lib/digits'

/** The full name of a weekday in a language ("Tuesday", "الثلاثاء"), for the course page's weekly times. */

// 28 February 2026 is a Saturday, the first day of `WEEKDAYS`.
const SATURDAY = '2026-02-28'

export const weekdayName = (weekday: Weekday, locale: string): string =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${addDays(SATURDAY, WEEKDAYS.indexOf(weekday))}T00:00:00Z`),
  )

/** A Cairo day written short ("Tue 18 Nov", "الثلاثاء ١٨ نوفمبر"), for text that lists meetings. */
export const dayLabel = (day: string, locale: string): string =>
  new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    numberingSystem: numberingSystemOf(locale),
  }).format(new Date(`${day}T00:00:00Z`))
