import type { Locale } from '@/i18n/routing'
import type { CalendarMeeting } from '@/lib/calendar'
import { relId } from '@/lib/relation'
import type { mySpaces } from '@/lib/spaces-data'

type Rooms = Pick<Awaited<ReturnType<typeof mySpaces>>, 'courses'>

/** The room when the reader has one; else the course page on the site; else nothing to open. */
export const sessionHref = (
  { courseId, href }: Pick<CalendarMeeting, 'courseId' | 'href'>,
  rooms: Rooms | null,
  locale: Locale,
): string | null =>
  rooms?.courses.find(({ space }) => relId(space.course) === courseId)?.href ??
  (href ? `/${locale}${href}` : null)
