import type { CalendarBlock, CalendarItem } from '@/lib/calendar-items'
import { toneOf } from '@/lib/calendar'
import { byWhen, numberedSessions } from '@/lib/meetings'
import type { Course, Session } from '@/payload-types'

export type Delivery = NonNullable<Session['delivery']>

/**
 * Where a session meets, in words: "Online", or "In person · Darb 1718" when
 * the course has a place. The session's own delivery wins over the course's
 * location; a course held more than one way is hybrid. Null when nothing says.
 */
export const deliveryOf = (
  session: Pick<Session, 'delivery'>,
  course: { location?: Course['location']; place?: string | null },
  delivery: SessionLabels['delivery'],
): string | null => {
  const location = course.location ?? []
  const mode = session.delivery ?? (location.length > 1 ? 'HYBRID' : (location[0] ?? null))
  if (!mode) return null
  return mode !== 'ONLINE' && course.place ? `${delivery(mode)} · ${course.place}` : delivery(mode)
}

export type SessionLabels = {
  /** What an untitled session is called: "Session 3". */
  untitled: (number: number) => string
  /** How a session meets, in words: "Online". */
  delivery: (value: Delivery) => string
}

/** The start of a description, for a short preview: the popover clamps it to a few lines. */
const SUMMARY_LENGTH = 280

/** A session in words: "Session 3: Title", or "Session 3" with no title. */
export const sessionName = (
  number: number,
  title: string | null | undefined,
  untitled: SessionLabels['untitled'],
): string => (title ? `${untitled(number)}: ${title}` : untitled(number))

/** A course's sessions as calendar items: a session is an item, a meeting its block. */
export const sessionItems = (
  sessions: readonly CalendarSession[],
  // The admin reads the draft, and a draft may not have its type yet.
  course: {
    course_type?: Course['course_type'] | null
    location?: Course['location']
    /** The name of the place the course meets at in person (`coursePlaceName`). */
    place?: string | null
  },
  { untitled, delivery }: SessionLabels,
): CalendarItem[] => {
  const tone = toneOf({ type: course.course_type?.toLowerCase() ?? '' })
  return numberedSessions(sessions).map(({ session, number }): CalendarItem => {
    const place = deliveryOf(session, course, delivery)
    const summary = session.description?.trim().slice(0, SUMMARY_LENGTH)
    return {
      id: String(session.id),
      sessionId: String(session.id),
      kind: 'session',
      title: session.title || untitled(number),
      // An untitled session is already called "Session 3".
      ...(session.title ? { caption: untitled(number) } : {}),
      ...(summary ? { summary } : {}),
      tone,
      ...(place ? { place } : {}),
      cancelled: Boolean(session.cancelled),
      version: session.updatedAt,
      blocks: [...(session.meetings ?? [])].sort(byWhen).map((m): CalendarBlock => ({
        id: m.id ?? '',
        date: m.date,
        start_time: m.start_time || null,
        end_time: m.end_time || null,
      })),
    }
  })
}

export type CalendarSession = Pick<
  Session,
  'id' | 'title' | 'cancelled' | 'meetings' | 'position' | 'updatedAt' | 'delivery' | 'description'
>
