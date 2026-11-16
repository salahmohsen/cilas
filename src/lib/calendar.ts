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
  /** The meeting's own id, the feed's UID. */
  key: string
  /** The session or event it belongs to: meetings with the same `item` are one thing on the calendar. */
  item: string
  kind: 'course' | 'event'
  title: string
  href: string | null
  date: string
  start?: string
  end?: string
  /** "Session 3", for a course meeting. */
  session?: number
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
  'key' | 'item' | 'date' | 'start' | 'end' | 'session' | 'cancelled' | 'place'
>

/**
 * A course's meetings, each with its session's number and place. Each is
 * named by `meetingKey`, so a calendar app that subscribed updates the
 * entry when other meetings are added or moved.
 */
export const courseItems = (
  base: CalendarBase,
  sessions: readonly (SessionTimes & { id: number | string; place?: string | null })[],
): CalendarMeeting[] =>
  numberedSessions(sessions).flatMap(({ session, number, meetings }) =>
    meetings.map((m): CalendarMeeting => ({
      ...base,
      key: `s${meetingKey(session.id, m)}`,
      item: `s${session.id}`,
      date: m.date,
      ...(m.start_time ? { start: m.start_time } : {}),
      ...(m.end_time ? { end: m.end_time } : {}),
      session: number,
      ...(session.place ? { place: session.place } : {}),
      ...(m.cancelled ? { cancelled: true } : {}),
    })),
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
