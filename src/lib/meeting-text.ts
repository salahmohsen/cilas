import { addDays, WEEKDAYS, type Weekday } from '@/lib/cairo-day'

/** The full name of a weekday in a language ("Tuesday", "الثلاثاء"), for the course page's weekly times. */

// 28 February 2026 is a Saturday, the first day of `WEEKDAYS`.
const SATURDAY = '2026-02-28'

export const weekdayName = (weekday: Weekday, locale: string): string =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${addDays(SATURDAY, WEEKDAYS.indexOf(weekday))}T00:00:00Z`),
  )
