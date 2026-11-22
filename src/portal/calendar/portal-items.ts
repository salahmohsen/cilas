import { byTime, type CalendarMeeting } from '@/lib/calendar'
import type { CalendarItem } from '@/lib/calendar-items'

export const MINE = 'course:mine'
export const OTHER = 'course:other'

/** One tone and one edge per portal course kind: no event type has an edge, so the shape tells a course from an event. */
export const KIND_LOOK = {
  [MINE]: { tone: 'pink', edge: 'solid' },
  [OTHER]: { tone: 'neutral', edge: 'double' },
} as const satisfies Record<string, Pick<CalendarItem, 'tone' | 'edge'>>

/**
 * One copy of each session: the reader's own meetings, then the public ones
 * whose session is not among them. The own copy wins because it is read fresh,
 * and the public list can be up to an hour old.
 */
export const mergeMeetings = (
  publicList: readonly CalendarMeeting[],
  own: readonly CalendarMeeting[],
): CalendarMeeting[] => {
  const sessions = new Set(own.flatMap((meeting) => meeting.sessionId ?? []))
  return [
    ...own,
    ...publicList.filter((meeting) => !meeting.sessionId || !sessions.has(meeting.sessionId)),
  ].sort(byTime)
}

const rankOf = (item: CalendarItem, ownCourseIds: ReadonlySet<string>) =>
  item.parentId === undefined ? 2 : ownCourseIds.has(item.parentId) ? 0 : 1

/**
 * The portal's kinds: a course item is Your courses or Other courses, with
 * that kind's tone and edge, and an event keeps its own kind and tone and gets
 * no edge. The order is Your courses, Other courses, then events, each in its
 * input order, so the legend lists them so.
 */
export const portalItems = (
  items: readonly CalendarItem[],
  ownCourseIds: ReadonlySet<string>,
): CalendarItem[] =>
  items
    .map((item): CalendarItem => {
      if (item.parentId === undefined) return item
      const kind = ownCourseIds.has(item.parentId) ? MINE : OTHER
      return { ...item, kind, ...KIND_LOOK[kind] }
    })
    .toSorted((a, b) => rankOf(a, ownCourseIds) - rankOf(b, ownCourseIds))

/** The courses the reader's gated read returned meetings for. */
export const ownCourseIdsOf = (own: readonly CalendarMeeting[]): Set<string> =>
  new Set(
    own.flatMap((meeting) => (meeting.courseId === undefined ? [] : [String(meeting.courseId)])),
  )

/** The kinds that start hidden: Other courses, once the reader has a course of their own to show. */
export const presetHidden = (ownCourseIds: ReadonlySet<string>): string[] =>
  ownCourseIds.size ? [OTHER] : []
