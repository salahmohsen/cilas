import { addDays, WEEKDAYS, type Weekday } from '@/lib/cairo-day'
import { localDigits } from '@/lib/digits'
import { listSeparator } from '@/lib/locale-format'
import type { WeeklyTime } from '@/lib/meetings'

/**
 * Weekly times as words, the way the course page writes them: the weekday's
 * full name in the page's language, then the Cairo times with the page's
 * digits ("Tuesday, 19:00–21:00"; "الثلاثاء، ١٩:٠٠–٢١:٠٠"). Plain text, for
 * places with no markup; the page adds its own direction marks.
 */

// 28 February 2026 is a Saturday, the first day of `WEEKDAYS`.
const SATURDAY = '2026-02-28'

/** The full name of a weekday in a language. */
export const weekdayName = (weekday: Weekday, locale: string): string =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${addDays(SATURDAY, WEEKDAYS.indexOf(weekday))}T00:00:00Z`),
  )

const SEMICOLON: Record<string, string> = { ar: '؛ ' }

/** One weekly time: "Tuesday, 19:00–21:00", or "Tuesday" for all day. */
export const weeklyTimeText = (time: WeeklyTime, locale: string): string => {
  const day = weekdayName(time.weekday, locale)
  const hours = [time.start_time, time.end_time].filter(Boolean).join('–')
  return hours ? `${day}${listSeparator(locale)}${localDigits(hours, locale)}` : day
}

/** Several weekly times in one line, separated by semicolons. */
export const weeklyTimesText = (times: readonly WeeklyTime[], locale: string): string =>
  times.map((time) => weeklyTimeText(time, locale)).join(SEMICOLON[locale] ?? '; ')
