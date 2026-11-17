import { type Locale, otherLocale } from '@/i18n/routing'
import { mediaCover, mediaPopulate } from '@/lib/media-image'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import { getCourseSessions } from '@/api/sessions.api'
import { courseItems, type CalendarMeeting } from '@/lib/calendar'
import { calendarWords } from '@/lib/calendar-context'
import { deliveryOf } from '@/lib/calendar-sources'
import { eventItems } from '@/lib/events'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import { relId } from '@/lib/relation'
import type { Media } from '@/payload-types'

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

/**
 * Every meeting the calendar can show, in date order: every meeting of every
 * published course (from its sessions, ADR 0011) and every public event.
 */
export const getCalendarItems = async (
  payload: Payload,
  locale: Locale,
): Promise<CalendarMeeting[]> => {
  const fallbackLocale = otherLocale(locale)
  const [courses, events, words] = await Promise.all([
    payload.find({
      collection: 'courses',
      where: visible,
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
      },
      populate: { media },
      locale,
      fallbackLocale,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'events',
      where: { tier: { equals: 'public' } },
      depth: 1,
      pagination: false,
      select: { title: true, slug: true, event_type: true, schedule: true, cover_image: true },
      locale,
      fallbackLocale,
      overrideAccess: false,
    }),
    calendarWords(locale),
  ])
  const cycleOf = (course: (typeof courses.docs)[number]) => relId(course.cycle)
  const [sessions, places] = await Promise.all([
    getCourseSessions(
      payload,
      courses.docs.map((c) => c.id),
      { locale, reader: null },
    ),
    placesOf(
      payload,
      [...new Set(courses.docs.flatMap((c) => cycleOf(c) ?? []))].map(Number),
      locale,
    ),
  ])

  const items: CalendarMeeting[] = [
    ...courses.docs.flatMap((c) => {
      const cycle = cycleOf(c)
      const course = {
        location: c.location,
        place: cycle == null ? null : (places.get(Number(cycle)) ?? null),
      }
      return courseItems(
        {
          kind: 'course',
          courseId: c.id,
          title: c.title,
          href: detailPath('courses', String(c.slug)),
          type: c.course_type.toLowerCase(),
          cover: coverOf(c.cover_image),
        },
        (sessions.get(c.id) ?? []).map((session) => ({
          ...session,
          place: deliveryOf(session, course, words.delivery),
        })),
      )
    }),
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
  ]
  return items.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''),
  )
}

/** The meetings above, built once per language and kept until a course changes. */
export const getCachedCalendarItems = unstable_cache(
  async (locale: Locale) => getCalendarItems(await getPayload({ config }), locale),
  ['calendar-items-v9'],
  { tags: [PUBLIC_LISTS_TAG], revalidate: 3600 },
)

/** The meetings from `from` to `to`, both Cairo days, from the one cached list. */
export const getCalendarRange = async (locale: Locale, from: string, to: string) =>
  (await getCachedCalendarItems(locale)).filter((m) => m.date >= from && m.date <= to)
