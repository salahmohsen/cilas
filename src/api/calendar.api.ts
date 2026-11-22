import { type Locale, otherLocale } from '@/i18n/routing'
import { mediaCover, mediaPopulate } from '@/lib/media-image'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import { courseOnSite } from '@/api/courses.api'
import { getCourseSessions } from '@/api/sessions.api'
import { byTime, courseItems, type CalendarMeeting } from '@/lib/calendar'
import { calendarWords } from '@/lib/calendar-context'
import { deliveryOf } from '@/lib/session-items'
import { eventItems } from '@/lib/events'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import type { Course, Media, User } from '@/payload-types'

const visible: Where = {
  and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }],
}
const media = mediaPopulate

const coverOf = (value: unknown): CalendarMeeting['cover'] => {
  const m = value && typeof value === 'object' ? (value as Media) : null
  return mediaCover(m)
}

const placeOf = (course: Pick<Course, 'cycle'>): string | null => {
  const { cycle } = course
  const place = typeof cycle === 'object' && cycle ? cycle.place : null
  return typeof place === 'object' && place?.name ? place.name : null
}

type CourseSource =
  | { kind: 'public' }
  | { kind: 'reader'; reader: User; courseIds: readonly number[] }

const PUBLIC_SOURCE = { kind: 'public' } as const satisfies CourseSource

const gateOf = (source: CourseSource) => {
  switch (source.kind) {
    case 'public':
      return { query: { where: visible }, reader: null }
    case 'reader':
      return source.courseIds.length
        ? {
            query: {
              where: { id: { in: [...source.courseIds] } } satisfies Where,
              user: source.reader,
            },
            reader: source.reader,
          }
        : null
    default: {
      const never: never = source
      return never
    }
  }
}

/**
 * The meetings of the courses a source names, from their sessions (ADR 0011).
 * The public source reads every published public course with no user. The
 * reader source reads the given courses as that reader, so access decides
 * which of them and which sessions come back.
 */
const courseMeetings = async (
  payload: Payload,
  locale: Locale,
  source: CourseSource,
): Promise<CalendarMeeting[]> => {
  const gate = gateOf(source)
  if (!gate) return []
  const [courses, words] = await Promise.all([
    payload.find({
      collection: 'courses',
      ...gate.query,
      depth: 2,
      joins: false,
      pagination: false,
      select: {
        title: true,
        slug: true,
        course_type: true,
        cover_image: true,
        location: true,
        cycle: true,
        tier: true,
        _status: true,
      },
      populate: { media, cycles: { place: true }, places: { name: true } },
      locale,
      fallbackLocale: otherLocale(locale),
      overrideAccess: false,
    }),
    calendarWords(locale),
  ])
  const sessions = await getCourseSessions(
    payload,
    courses.docs.map((c) => c.id),
    { locale, reader: gate.reader },
  )
  return courses.docs.flatMap((c) => {
    const course = { location: c.location, place: placeOf(c) }
    const opens = Boolean(c.slug) && courseOnSite(c, gate.reader)
    return courseItems(
      {
        kind: 'course',
        courseId: c.id,
        title: c.title,
        href: opens ? detailPath('courses', String(c.slug)) : null,
        type: c.course_type?.toLowerCase() ?? 'course',
        cover: coverOf(c.cover_image),
      },
      (sessions.get(c.id) ?? []).map((session) => ({
        ...session,
        place: deliveryOf(session, course, words.delivery),
      })),
    )
  })
}

/**
 * Every meeting the calendar can show, in date order: every meeting of every
 * published course and every public event.
 */
export const getCalendarItems = async (
  payload: Payload,
  locale: Locale,
): Promise<CalendarMeeting[]> => {
  const [courses, events] = await Promise.all([
    courseMeetings(payload, locale, PUBLIC_SOURCE),
    payload.find({
      collection: 'events',
      where: { tier: { equals: 'public' } },
      depth: 1,
      pagination: false,
      select: { title: true, slug: true, event_type: true, schedule: true, cover_image: true },
      locale,
      fallbackLocale: otherLocale(locale),
      overrideAccess: false,
    }),
  ])
  return [
    ...courses,
    ...events.docs.flatMap((e) =>
      eventItems(
        e.id,
        {
          kind: 'event',
          title: e.title,
          href: detailPath('events', String(e.slug)),
          type: e.event_type ?? 'event',
          cover: coverOf(e.cover_image),
        },
        e.schedule,
      ),
    ),
  ].sort(byTime)
}

/**
 * The meetings of the courses `courseIds` that `reader` may read, in date
 * order. Read for this reader on every call: it never enters the cache below.
 */
export const getReaderCalendarItems = async (
  payload: Payload,
  locale: Locale,
  reader: User,
  courseIds: readonly number[],
): Promise<CalendarMeeting[]> =>
  (await courseMeetings(payload, locale, { kind: 'reader', reader, courseIds })).sort(byTime)

/** The meetings above, built once per language and kept until a course changes. */
export const getCachedCalendarItems = unstable_cache(
  async (locale: Locale) => getCalendarItems(await getPayload({ config }), locale),
  ['calendar-items-v10'],
  { tags: [PUBLIC_LISTS_TAG], revalidate: 3600 },
)

/** The meetings from `from` to `to`, both Cairo days, from the one cached list. */
export const getCalendarRange = async (locale: Locale, from: string, to: string) =>
  (await getCachedCalendarItems(locale)).filter((m) => m.date >= from && m.date <= to)
