import type { Payload } from 'payload'

import { getReaderCalendarItems } from '@/api/calendar.api'
import type { Locale } from '@/i18n/routing'
import { cairoDay } from '@/lib/cairo-day'
import type { CalendarMeeting } from '@/lib/calendar'
import { readerCourseIds } from '@/lib/reader-courses'
import { relId } from '@/lib/relation'
import { mySpaces } from '@/lib/spaces-data'
import type { User } from '@/payload-types'

export type NextSession = Pick<
  CalendarMeeting,
  'title' | 'session' | 'sessionTitle' | 'date' | 'start' | 'cover' | 'href'
>

export async function nextSession(
  payload: Payload,
  user: User,
  locale: Locale,
): Promise<NextSession | null> {
  const courseIds = await readerCourseIds(payload, user)
  const today = cairoDay(new Date())
  if (!courseIds.length || !today) return null

  const meetings = await getReaderCalendarItems(payload, locale, user, courseIds)
  const meeting = meetings.find((item) => !item.cancelled && item.date >= today)
  if (!meeting) return null

  const { courses } = await mySpaces(payload, user, locale)
  const room = courses.find(({ space }) => relId(space.course) === meeting.courseId)
  const { title, session, sessionTitle, date, start, cover, href } = meeting
  return {
    title,
    session,
    sessionTitle,
    date,
    start,
    cover,
    href: room?.href ?? (href ? `/${locale}${href}` : null),
  }
}
