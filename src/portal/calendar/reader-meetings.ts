import type { Payload } from 'payload'
import { cache } from 'react'

import { getReaderCalendarItems } from '@/api/calendar.api'
import type { Locale } from '@/i18n/routing'
import type { CalendarMeeting } from '@/lib/calendar'
import { readerCourseIds } from '@/lib/reader-courses'
import type { User } from '@/payload-types'

/** The reader's own course meetings, in date order. One read for each request: the shell and Home share it. */
export const readerMeetings = cache(
  async (payload: Payload, user: User, locale: Locale): Promise<CalendarMeeting[]> =>
    getReaderCalendarItems(payload, locale, user, await readerCourseIds(payload, user)),
)
