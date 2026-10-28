import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import type { Locale } from '@/api/articles.api'
import { cairoDay } from '@/lib/cairo-day'
import { COURSES_TAG } from '@/lib/revalidate-courses'
import { expandSchedule, type Schedule, type SessionDates } from '@/lib/schedule'
import type { Media } from '@/payload-types'
import type { FocalPoint } from '@/lib/media-image'

/** One thing on the calendar: a course meeting, a course's first day, or an event. */
export type CalendarItem = {
  key: string
  kind: 'course' | 'event'
  /** A course with no weekly times is placed on its first day only. */
  starts?: boolean
  title: string
  href: string | null
  date: string
  start?: string
  end?: string
  /** "Session 3", for a course meeting. */
  session?: number
  /** Course type (`thematic`…) or event type, for its label. */
  type: string
  cover?: { url: string; alt: string } & FocalPoint
  cancelled?: boolean
}

const visible: Where = {
  and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }],
}
const media = { url: true, alt: true, focalX: true, focalY: true, filename: true, prefix: true } as const

const coverOf = (value: unknown): CalendarItem['cover'] => {
  const m = value && typeof value === 'object' ? (value as Media) : null
  return m?.url ? { url: m.url, alt: m.alt ?? '', focalX: m.focalX, focalY: m.focalY } : undefined
}

/**
 * Everything the calendar can show, in date order: every meeting of every
 * published course (its dates come from its schedule, ADR 0002), the first
 * day of a course that has no weekly times, and every public event.
 */
export const getCalendarItems = async (
  payload: Payload,
  locale: Locale,
): Promise<CalendarItem[]> => {
  const fallbackLocale = locale === 'ar' ? 'en' : 'ar'
  const [courses, events] = await Promise.all([
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
        schedule: true,
        sessions: { order: true, meetings: true, cancelled: true, dates: true },
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
  ])

  const items: CalendarItem[] = []
  for (const c of courses.docs) {
    const schedule = c.schedule as Schedule | null
    const base = {
      kind: 'course' as const,
      title: c.title,
      href: `/study/${c.slug}`,
      type: c.course_type.toLowerCase(),
      cover: coverOf(c.cover_image),
    }
    const meetings = expandSchedule(schedule, c.sessions as SessionDates[] | null)
    meetings.forEach((m, i) =>
      items.push({
        ...base,
        key: `c${c.id}-${i}`,
        date: m.date,
        start: m.start_time,
        end: m.end_time,
        ...(m.session ? { session: m.session } : {}),
        ...(m.cancelled ? { cancelled: true } : {}),
      }),
    )
    // No weekly times: the course is shown on the day it starts, when that day is known.
    const first =
      schedule?.start_precision !== 'week' && schedule?.start_date
        ? cairoDay(schedule.start_date)
        : null
    if (!meetings.length && first)
      items.push({ ...base, key: `c${c.id}-start`, date: first, starts: true })
  }

  for (const e of events.docs) {
    const schedule = e.schedule as Schedule | null
    const base = {
      kind: 'event' as const,
      title: e.title,
      href: `/events/${e.slug}`,
      cover: coverOf(e.cover_image),
      type: e.event_type ?? 'event',
    }
    const meetings = expandSchedule(schedule)
    meetings.forEach((m, i) =>
      items.push({
        ...base,
        key: `e${e.id}-${i}`,
        date: m.date,
        start: m.start_time,
        end: m.end_time,
      }),
    )
    const first = schedule?.start_date ? cairoDay(schedule.start_date) : null
    if (!meetings.length && first) items.push({ ...base, key: `e${e.id}-day`, date: first })
  }

  return items.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''),
  )
}

/** The items above, built once per language and kept until a course changes. */
export const getCachedCalendarItems = unstable_cache(
  async (locale: Locale) => getCalendarItems(await getPayload({ config }), locale),
  ['calendar-items-v2'],
  { tags: [COURSES_TAG], revalidate: 3600 },
)

/**
 * Public events with their places and speakers resolved for JSON-LD.
 * Event writes invalidate this cache alongside the calendar.
 */
export const getCachedSchemaEvents = unstable_cache(
  async (locale: Locale) => {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'events',
      where: { tier: { equals: 'public' } },
      depth: 2,
      pagination: false,
      select: {
        title: true,
        description: true,
        schedule: true,
        place: true,
        external_venue: true,
        online_url: true,
        agenda: true,
        speakers: true,
        pricing: true,
        registration: true,
      },
      populate: {
        places: { name: true, address: true, map_url: true },
        people: { name: true, slug: true },
      },
      locale,
      fallbackLocale: locale === 'ar' ? 'en' : 'ar',
      overrideAccess: false,
    })
    return docs
  },
  ['schema-events'],
  { tags: [COURSES_TAG], revalidate: 3600 },
)
