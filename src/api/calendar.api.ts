import { type Locale, otherLocale } from '@/i18n/routing'
import { mediaCover, mediaPopulate } from '@/lib/media-image'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import { getCourseSessions } from '@/api/sessions.api'
import { courseItems, type CalendarMeeting } from '@/lib/calendar'
import { calendarWords } from '@/lib/calendar-context'
import { deliveryOf } from '@/lib/session-items'
import { eventItems } from '@/lib/events'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import { relId } from '@/lib/relation'
import type { Media, User } from '@/payload-types'

const visible: Where = {
  and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }],
}
const media = mediaPopulate

const coverOf = (value: unknown): CalendarMeeting['cover'] => {
  const m = value && typeof value === 'object' ? (value as Media) : null
  return mediaCover(m)
}

/** The names of the places the cycles meet at, by cycle id, as the public may read them. */
const placesOf = async (
  payload: Payload,
  cycles: number[],
  locale: Locale,
): Promise<Map<number, string>> => {
  if (!cycles.length) return new Map()
  const { docs } = await payload.find({
    collection: 'cycles',
    where: { id: { in: cycles } },
    depth: 1,
    pagination: false,
    select: { place: true },
    populate: { places: { name: true } },
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
  })
  return new Map(
    docs.flatMap((cycle) =>
      typeof cycle.place === 'object' && cycle.place?.name ? [[cycle.id, cycle.place.name]] : [],
    ),
  )
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

const byTime = (a: CalendarMeeting, b: CalendarMeeting) =>
  a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')

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
      depth: 1,
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
      populate: { media },
      locale,
      fallbackLocale: otherLocale(locale),
      overrideAccess: false,
    }),
    calendarWords(locale),
  ])
  const cycleOf = (course: (typeof courses.docs)[number]) => relId(course.cycle)
  const [sessions, places] = await Promise.all([
    getCourseSessions(
      payload,
      courses.docs.map((c) => c.id),
      { locale, reader: gate.reader },
    ),
    placesOf(
      payload,
      [...new Set(courses.docs.flatMap((c) => cycleOf(c) ?? []))].map(Number),
      locale,
    ),
  ])
  return courses.docs.flatMap((c) => {
    const cycle = cycleOf(c)
    const course = {
      location: c.location,
      place: cycle == null ? null : (places.get(Number(cycle)) ?? null),
    }
    const opens = Boolean(c.slug) && c._status === 'published' && c.tier !== 'owner'
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
