import type { FocalPoint } from '@/lib/media-image'
import { addDays, weekdayOf, WEEKDAYS } from '@/lib/cairo-day'
import { meetingKey, numberedSessions, type SessionTimes } from '@/lib/meetings'
import type { CalendarTone } from '@/lib/calendar-items'

/**
 * The public calendar's meetings: every meeting of a published course and
 * of a public event, one entry each, for the page and the feed. Days are
 * `YYYY-MM-DD` Cairo days (see cairo-day.ts); weeks start on Saturday, as Egypt's do.
 */
export type CalendarMeeting = {
  /** The display key, which includes the date and time. */
  key: string
  feed?: { uid: string; updatedAt: string }
  /** The session or event it belongs to: meetings with the same `item` are one thing on the calendar. */
  item: string
  sessionId?: string
  courseId?: number
  kind: 'course' | 'event'
  title: string
  href: string | null
  date: string
  start?: string
  end?: string
  /** "Session 3", for a course meeting. */
  session?: number
  /** The session's own title, when it has one (the other language's when this one is empty). */
  sessionTitle?: string
  /** How many materials and activities the session lists; left out when none. */
  materials?: number
  activities?: number
  /** Course type (`thematic`…) or event type, for its label. */
  type: string
  /** How and where it meets, in words: "In person · Darb 1718". */
  place?: string
  cover?: { url: string; alt: string } & FocalPoint
  cancelled?: boolean
}

/** What every meeting of one course or event shares. */
export type CalendarBase = Omit<
  CalendarMeeting,
  | 'feed'
  | 'key'
  | 'item'
  | 'date'
  | 'start'
  | 'end'
  | 'session'
  | 'sessionTitle'
  | 'materials'
  | 'activities'
  | 'cancelled'
  | 'place'
>

/** A course's meetings with separate display keys and stored feed identities. */
export const courseItems = (
  base: CalendarBase,
  sessions: readonly (SessionTimes & {
    id: number | string
    updatedAt: string
    place?: string | null
    title?: string | null
    bibliography?: readonly unknown[] | null
    activities?: readonly unknown[] | null
  })[],
): CalendarMeeting[] =>
  numberedSessions(sessions).flatMap(({ session, number, meetings }) =>
    meetings.map((m): CalendarMeeting => {
      if (!m.id) throw new Error(`Session ${session.id} has a meeting without a row ID`)
      return {
        ...base,
        key: `s${meetingKey(session.id, m)}`,
        feed: { uid: `session-meeting-${m.id}@cilas.org`, updatedAt: session.updatedAt },
        item: `s${session.id}`,
        sessionId: String(session.id),
        date: m.date,
        ...(m.start_time ? { start: m.start_time } : {}),
        ...(m.end_time ? { end: m.end_time } : {}),
        session: number,
        ...(session.place ? { place: session.place } : {}),
        ...(session.title?.trim() ? { sessionTitle: session.title.trim() } : {}),
        ...(session.bibliography?.length ? { materials: session.bibliography.length } : {}),
        ...(session.activities?.length ? { activities: session.activities.length } : {}),
        ...(m.cancelled ? { cancelled: true } : {}),
      }
    }),
  )

export const weekStart = (day: string): string => addDays(day, -WEEKDAYS.indexOf(weekdayOf(day)))

/**
 * One tone per kind of course or event, so a day reads by colour at
 * a glance: the programme's own courses (core, thematic, lab), the short
 * formats, and events grouped by what they are (talks, arts, visits).
 */
const TYPE_TONES: Record<string, CalendarTone> = {
  core: 'yellow',
  thematic: 'blue',
  lab: 'green',
  workshop: 'pink',
  short: 'pink',
  talk: 'blue',
  panel: 'blue',
  book_discussion: 'blue',
  reading_group: 'blue',
  screening: 'yellow',
  performance: 'yellow',
  music: 'yellow',
  exhibition: 'yellow',
  open_day: 'green',
  residency: 'green',
  visit: 'green',
}

/** Every known type, courses first, in the order a legend lists them. */
export const TYPE_ORDER = Object.keys(TYPE_TONES)

/** The tone of an item's type; a type with none yet is neutral. */
export const toneOf = (item: Pick<CalendarMeeting, 'type'>): CalendarTone =>
  TYPE_TONES[item.type] ?? 'neutral'
