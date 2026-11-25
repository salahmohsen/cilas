import type { Locale } from '@/i18n/routing'
import { CAIRO } from '@/lib/cairo-day'
import type { CalendarMeeting } from '@/lib/calendar'
import { numberingSystemOf } from '@/lib/digits'

/** A Cairo date or time in the reader's language and digits. */
export const cairoFormat = (locale: Locale, options: Intl.DateTimeFormatOptions, at: Date) =>
  new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: CAIRO,
    numberingSystem: numberingSystemOf(locale),
  }).format(at)

/** The session's own title, else "Session N", else the course or event title. */
export const meetingHeading = (
  meeting: Pick<CalendarMeeting, 'title' | 'session' | 'sessionTitle'>,
  sessionNumber: (number: number) => string,
) =>
  meeting.sessionTitle ??
  (meeting.session === undefined ? meeting.title : sessionNumber(meeting.session))
