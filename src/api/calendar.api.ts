import { type Locale, otherLocale } from '@/i18n/routing'
import { mediaCover, mediaPopulate } from '@/lib/media-image'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import { getCourseSessions } from '@/api/sessions.api'
import { courseItems, type CalendarItem } from '@/lib/calendar'
import { eventItems } from '@/lib/events'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import type { Media } from '@/payload-types'

const visible: Where = {
  and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }],
}
const media = mediaPopulate

const coverOf = (value: unknown): CalendarItem['cover'] => {
  const m = value && typeof value === 'object' ? (value as Media) : null
  return mediaCover(m)
}

/**
 * Everything the calendar can show, in date order: every meeting of every
 * published course (from its sessions, ADR 0011) and every public event.
 */
const getCalendarItems = async (payload: Payload, locale: Locale): Promise<CalendarItem[]> => {
  const fallbackLocale = otherLocale(locale)
  const [courses, events] = await Promise.all([
    payload.find({
      collection: 'courses',
      where: visible,
      depth: 1,
      joins: false,
      pagination: false,
      select: { title: true, slug: true, course_type: true, cover_image: true },
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
  ])
  const sessions = await getCourseSessions(
    payload,
    courses.docs.map((c) => c.id),
    { locale, reader: null },
  )

  const items: CalendarItem[] = [
    ...courses.docs.flatMap((c) =>
      courseItems(
        {
          kind: 'course',
          title: c.title,
          href: detailPath('courses', String(c.slug)),
          type: c.course_type.toLowerCase(),
          cover: coverOf(c.cover_image),
        },
        sessions.get(c.id) ?? [],
      ),
    ),
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

/** The items above, built once per language and kept until a course changes. */
export const getCachedCalendarItems = unstable_cache(
  async (locale: Locale) => getCalendarItems(await getPayload({ config }), locale),
  ['calendar-items-v3'],
  { tags: [PUBLIC_LISTS_TAG], revalidate: 3600 },
)
