import { type Locale, otherLocale } from '@/i18n/routing'
import { mediaCover, mediaPopulate } from '@/lib/media-image'
import { detailPath } from '@/lib/paths'
import { hasDayPrecision } from '@/lib/schedule'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload, type Payload, type Where } from 'payload'

import { cairoDay } from '@/lib/cairo-day'
import type { CalendarItem } from '@/lib/calendar'
import { PUBLIC_LISTS_TAG } from '@/lib/paths'
import { expandSchedule, type Schedule, type SessionDates } from '@/lib/schedule'
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
 * published course (its dates come from its schedule, ADR 0002), the first
 * day of a course that has no weekly times, and every public event.
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
  const add = (
    id: number,
    base: Omit<CalendarItem, 'key' | 'date'>,
    schedule: Schedule | null | undefined,
    sessions?: SessionDates[] | null,
  ) => {
    if (base.kind === 'event' && !hasDayPrecision(schedule)) return
    const prefix = `${base.kind === 'course' ? 'c' : 'e'}${id}`
    const meetings = expandSchedule(schedule, sessions)
    meetings.forEach((m, i) =>
      items.push({
        ...base,
        key: `${prefix}-${i}`,
        date: m.date,
        start: m.start_time,
        end: m.end_time,
        ...(m.session ? { session: m.session } : {}),
        ...(m.cancelled ? { cancelled: true } : {}),
      }),
    )
    // No weekly times: show the first day only when that day is known.
    const first =
      hasDayPrecision(schedule) && schedule?.start_date ? cairoDay(schedule.start_date) : null
    if (!meetings.length && first)
      items.push({
        ...base,
        key: `${prefix}-${base.kind === 'course' ? 'start' : 'day'}`,
        date: first,
        ...(base.kind === 'course' ? { starts: true } : {}),
      })
  }
  for (const c of courses.docs)
    add(
      c.id,
      {
        kind: 'course',
        title: c.title,
        href: detailPath('courses', String(c.slug)),
        type: c.course_type.toLowerCase(),
        cover: coverOf(c.cover_image),
      },
      c.schedule,
      c.sessions,
    )
  for (const e of events.docs)
    add(
      e.id,
      {
        kind: 'event',
        title: e.title,
        href: detailPath('events', String(e.slug)),
        type: e.event_type ?? 'event',
        cover: coverOf(e.cover_image),
      },
      e.schedule,
    )

  return items.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''),
  )
}

/** The items above, built once per language and kept until a course changes. */
export const getCachedCalendarItems = unstable_cache(
  async (locale: Locale) => getCalendarItems(await getPayload({ config }), locale),
  ['calendar-items-v2'],
  { tags: [PUBLIC_LISTS_TAG], revalidate: 3600 },
)
