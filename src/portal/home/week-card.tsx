import { useTranslations } from 'next-intl'
import Link from 'next/link'

import buttonStyles from '@/components/arc/button/button.module.css'
import { calendarQuery } from '@/components/calendar/calendar-url'
import type { Locale } from '@/i18n/routing'
import { cairoInstant, cairoNoon, weekdayOf } from '@/lib/cairo-day'
import { localDigits } from '@/lib/digits'

import styles from './home.module.css'
import { cairoFormat, meetingHeading } from './meeting-words'
import { sessionHref } from './session-link'
import { WEEK_HEADING_ID, type WeekDay } from './week'
import { WeekDays, type DayView, type RowView } from './week-days'

export function WeekCard({
  week,
  today,
  rooms,
  locale,
}: {
  week: WeekDay[]
  today: string
  rooms: Parameters<typeof sessionHref>[1]
  locale: Locale
}) {
  const t = useTranslations('Portal.home')
  const nav = useTranslations('Portal.nav')
  const calendar = useTranslations('CalendarUi')
  const calendarPath = `/${locale}/spaces/calendar`
  const emptyWeek = week.every((day) => !day.meetings.length)

  const rowOf = (meeting: WeekDay['meetings'][number]): RowView => {
    const instant = meeting.start ? cairoInstant(meeting.date, meeting.start) : null
    const title = meetingHeading(meeting, (number) => t('sessionNumber', { number }))
    return {
      key: meeting.key,
      href:
        sessionHref(meeting, rooms, locale) ??
        `${calendarPath}${calendarQuery('day', meeting.date)}`,
      time: instant
        ? cairoFormat(locale, { timeStyle: 'short' }, new Date(instant))
        : calendar('allDay'),
      dateTime: instant ?? meeting.date,
      title,
      context: meeting.title === title ? null : meeting.title,
      place: meeting.place ?? null,
    }
  }

  const days = week.map(({ date, meetings }) => {
    const count = meetings.length
    return {
      date,
      weekday: t(`week.weekdays.${weekdayOf(date)}`),
      number: localDigits(Number(date.slice(8)), locale),
      count,
      countLabel: t('week.count', { count, shown: localDigits(count, locale) }),
      listLabel: cairoFormat(
        locale,
        { weekday: 'long', day: 'numeric', month: 'long' },
        cairoNoon(date),
      ),
      empty: t(emptyWeek ? 'week.emptyWeek' : 'week.emptyDay'),
      rows: meetings.map(rowOf),
    } satisfies DayView
  })

  return (
    <section aria-labelledby={WEEK_HEADING_ID} className={styles.section} data-week>
      <div className={styles.weekHeader}>
        <h2 id={WEEK_HEADING_ID} className={styles.heading}>
          {t('week.title')}
        </h2>
        <Link
          href={calendarPath}
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.sm}`}
        >
          {nav('calendar')}
        </Link>
      </div>
      <WeekDays days={days} today={today} />
    </section>
  )
}
