import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { Payload } from 'payload'

import { adminViewOf, type AdminView } from '@/access'
import { getReaderCalendarItems } from '@/api/calendar.api'
import type { Locale } from '@/i18n/routing'
import { cairoDay, cairoNoon, cairoTime, CAIRO } from '@/lib/cairo-day'
import { localDigits } from '@/lib/digits'
import { focalPointStyle } from '@/lib/media-image'
import { readerCourseIds } from '@/lib/reader-courses'
import { parentRef } from '@/lib/space-ref'
import type { SpaceSummary } from '@/lib/spaces-data'
import type { User } from '@/payload-types'

import styles from './shell.module.css'

const CALENDAR = '/spaces/calendar'

const EMPTY_DESTINATION = {
  admin: CALENDAR,
  fellow: '/spaces/courses',
  student: '/spaces',
} satisfies Record<AdminView, string>

export async function SidebarNextSession({
  payload,
  user,
  locale,
  courses,
}: {
  payload: Payload
  user: User
  locale: Locale
  courses: SpaceSummary[]
}) {
  const [t, meetings] = await Promise.all([
    getTranslations('Portal.nextSession'),
    readerCourseIds(payload, user)
      .then((ids) => getReaderCalendarItems(payload, locale, user, ids))
      .catch((err: unknown) => {
        payload.logger.error({ err }, 'portal sidebar: next session did not load')
        return null
      }),
  ])
  if (!meetings) return null

  const now = new Date()
  const day = cairoDay(now)!
  const time = cairoTime(now)!
  const next = meetings.find(
    (meeting) =>
      !meeting.cancelled &&
      (meeting.date > day || (meeting.date === day && (!meeting.start || meeting.start >= time))),
  )

  if (!next) {
    const view = adminViewOf(user) ?? 'student'
    return (
      <Link
        href={`/${locale}${EMPTY_DESTINATION[view]}`}
        className={styles.nextCard}
        data-sidebar-next
      >
        <small>{t('empty')}</small>
        <span>{t(view)}</span>
      </Link>
    )
  }

  const course = courses.find(({ space }) => parentRef(space)?.id === next.courseId)
  const href = course?.href ?? `/${locale}${next.href ?? CALENDAR}`
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: CAIRO }).format(
    cairoNoon(next.date),
  )
  const dateTime = next.start ? `${next.date}T${next.start}` : next.date
  const schedule = next.start ? `${weekday} ${localDigits(next.start, locale)}` : weekday
  return (
    <Link
      href={href}
      className={styles.nextCard}
      data-sidebar-next
      data-session-cover={Boolean(next.cover) || undefined}
    >
      {next.cover && (
        <Image src={next.cover.url} alt="" fill sizes="232px" style={focalPointStyle(next.cover)} />
      )}
      <span className={styles.nextCopy}>
        <small>
          {t('next')} · <time dateTime={dateTime}>{schedule}</time>
        </small>
        <bdi className={styles.nextTitle}>{next.sessionTitle ?? next.title}</bdi>
      </span>
    </Link>
  )
}
