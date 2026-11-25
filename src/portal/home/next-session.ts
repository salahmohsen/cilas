import { cache } from 'react'
import type { Payload } from 'payload'

import type { Locale } from '@/i18n/routing'
import type { CalendarMeeting } from '@/lib/calendar'
import { mySpaces } from '@/lib/spaces-data'
import type { User } from '@/payload-types'
import { readerMeetings } from '@/portal/calendar/reader-meetings'

import { sessionHref } from './session-link'
import { upcoming } from './upcoming'

export type NextSession = Pick<
  CalendarMeeting,
  'title' | 'session' | 'sessionTitle' | 'date' | 'start' | 'cover' | 'href'
>

/**
 * The reader's rooms, or null when they cannot be read. `mySpaces` is already
 * started by the layout; here a failure only costs the room link and the
 * community check, never the card. Cached, so a failure logs once.
 */
export const roomsOf = cache(async (payload: Payload, user: User, locale: Locale) => {
  try {
    return await mySpaces(payload, user, locale)
  } catch (error) {
    payload.logger.error({ err: error, msg: 'home: the reader’s spaces could not be read' })
    return null
  }
})

export async function nextSession(
  payload: Payload,
  user: User,
  locale: Locale,
): Promise<NextSession | null> {
  const [meetings, rooms] = await Promise.all([
    readerMeetings(payload, user, locale),
    roomsOf(payload, user, locale),
  ])
  const meeting = upcoming(meetings, new Date())
  if (!meeting) return null

  const { title, session, sessionTitle, date, start, cover } = meeting
  return {
    title,
    session,
    sessionTitle,
    date,
    start,
    cover,
    href: sessionHref(meeting, rooms, locale),
  }
}
