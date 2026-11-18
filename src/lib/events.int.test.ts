import { readFile } from 'node:fs/promises'

import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPublicEvent, getPublicEvents } from '@/api/events.api'
import { eventItems, eventTiming, orderEvents, otherUpcomingEvents } from '@/lib/events'
import { pathOf } from '@/lib/paths'
import { spaceEvents } from '@/lib/spaces-data'
import config from '@/payload.config'
import type { Event, User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'

const now = new Date('2026-10-28T16:30:00Z')
const scheduled = (id: number, start: string, weeks = 1) =>
  ({
    id,
    title: `Event ${id}`,
    slug: `event-${id}`,
    tier: 'public',
    event_type: 'talk',
    createdAt: '',
    updatedAt: '',
    schedule: {
      start_date: start,
      weeks,
      slots: [{ weekday: 'wed', start_time: '19:00', end_time: '20:00' }],
    },
  }) satisfies Event

let payload: Payload
const { track, cleanup } = createTracker()
let admin: User
let courseId: number
let publishedId: number
let draftId: number
let publicSlug: string
let ownerSlug: string
let coverId: number

const makeEvent = async (title: string, over: Record<string, unknown> = {}) => {
  const slug = uniq(title.toLowerCase().replace(/\W+/g, '-'))
  const event = await payload.create({
    collection: 'events',
    locale: 'en',
    data: {
      title,
      slug,
      tier: 'public',
      event_type: 'talk',
      schedule: {
        mode: 'single',
        start_date: '2035-10-30',
        start_time: '19:00',
        end_time: '20:00',
      },
      _status: 'published',
      ...over,
    } as never,
    overrideAccess: true,
  })
  track('events', event.id)
  return { id: event.id, slug }
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Events admin', slug: uniq('events-admin') },
      overrideAccess: true,
    }),
  ).id
  admin = track(
    'users',
    (await payload.create({
      collection: 'users',
      data: {
        email: uniqEmail('events-admin'),
        password: crypto.randomUUID(),
        roles: ['admin'],
        person,
      },
      overrideAccess: true,
    })) as unknown as User,
  )
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Events place', slug: uniq('events-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2035, place, start_date: '2035-10-04' },
      overrideAccess: true,
    }),
  ).id
  courseId = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Events probe',
        slug: uniq('events-probe'),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        registration: { mode: 'closed' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  ).id
  publishedId = (await makeEvent('Published course event', { course: courseId })).id
  draftId = (await makeEvent('Draft course event', { course: courseId, _status: 'draft' })).id
  const pixel = await readFile(new URL('../../testing/files/pixel.png', import.meta.url))
  coverId = track(
    'media',
    await payload.create({
      collection: 'media',
      data: { alt: 'Event cover probe' },
      file: {
        name: `${uniq('event-cover')}.png`,
        mimetype: 'image/png',
        data: pixel,
        size: pixel.length,
      },
      overrideAccess: true,
    }),
  ).id
  publicSlug = (await makeEvent('Public listed event', { cover_image: coverId })).slug
  ownerSlug = (await makeEvent('Owner only event', { tier: 'owner' })).slug
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('public event timing', () => {
  it('shows a course space only the published public events, even to an admin', async () => {
    const { docs: spaces } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: courseId } },
      overrideAccess: true,
      depth: 0,
    })
    const { upcoming, past } = await spaceEvents(payload, admin, spaces[0]!)
    const shown = [...upcoming, ...past].flatMap((item) =>
      item.type === 'public' ? [item.id] : [],
    )
    expect(shown).toContain(publishedId)
    expect(shown).not.toContain(draftId)
  })
  it('uses a screening’s primary time without requiring agenda entries', () => {
    const event = {
      schedule: {
        mode: 'single' as const,
        start_date: '2026-10-28',
        start_time: '19:00',
        end_time: '20:00',
      },
      agenda: [],
    }
    expect(eventTiming(event, now)).toMatchObject({
      status: 'upcoming',
      meeting: { start_time: '19:00', end_time: '20:00' },
    })
    expect(eventTiming(event, new Date('2026-10-28T17:00:00Z')).status).toBe('past')
  })
  it('shows at most three other upcoming events, soonest first, without past or undated events', () => {
    const events = [
      scheduled(1, '2026-11-18'),
      scheduled(2, '2026-11-04'),
      scheduled(3, '2026-11-11'),
      scheduled(4, '2026-10-21'),
      { ...scheduled(5, '2026-11-04'), schedule: {} },
      scheduled(6, '2026-11-25'),
      scheduled(7, '2026-12-02'),
    ]
    expect(otherUpcomingEvents(events, 2, now).map(({ id }) => id)).toEqual([3, 1, 6])
    expect(otherUpcomingEvents([scheduled(1, '2026-10-21')], 2, now)).toEqual([])
  })
  it('keeps an ongoing event, then archives it exactly when it ends', () => {
    const event = scheduled(1, '2026-10-28')
    expect(eventTiming(event, now).status).toBe('upcoming')
    expect(eventTiming(event, new Date('2026-10-28T17:00:00Z')).status).toBe('past')
  })
  it('features a recurring event by its next meeting, even after its start date', () => {
    expect(eventTiming(scheduled(1, '2026-10-21', 3), now)).toMatchObject({
      status: 'upcoming',
      day: '2026-10-28',
    })
    expect(
      eventTiming(scheduled(1, '2026-10-21', 3), new Date('2026-10-28T18:00:00Z')),
    ).toMatchObject({ status: 'upcoming', day: '2026-11-04' })
  })
  it('keeps date-only events through their Cairo day and separates uncertain dates', () => {
    const event = { schedule: { start_date: '2026-10-28' } }
    expect(eventTiming(event, now).status).toBe('upcoming')
    expect(eventTiming(event, new Date('2026-10-28T22:00:00Z')).status).toBe('past')
    expect(
      eventTiming({ schedule: { start_date: '2026-10-28', start_precision: 'week' } }, now).status,
    ).toBe('undated')
    expect(eventTiming({ schedule: {} }, now).status).toBe('undated')
  })
  it('archives a date-only event after its agenda ends', () => {
    expect(
      eventTiming(
        {
          schedule: { start_date: '2026-10-28' },
          agenda: [{ title: 'Talk', start_time: '18:00', end_time: '19:00' }],
        },
        now,
      ).status,
    ).toBe('past')
  })
  it('orders future events soonest first and archives newest first', () => {
    const events = [
      scheduled(1, '2026-11-11'),
      scheduled(2, '2026-10-21'),
      scheduled(3, '2026-11-04'),
      scheduled(4, '2026-10-14'),
    ]
    const groups = orderEvents(events, now)
    expect(groups.upcoming.map((e) => e.id)).toEqual([3, 1])
    expect(groups.past.map((e) => e.id)).toEqual([2, 4])
  })
  it('enforces anonymous access and public tier on listing and direct slug lookup', async () => {
    const listed = await getPublicEvents(payload, 'en')
    expect(listed.map((event) => event.slug)).toContain(publicSlug)
    expect(listed.map((event) => event.slug)).not.toContain(ownerSlug)
    expect(await getPublicEvent(payload, 'ar', ownerSlug)).toBeUndefined()
    const found = await getPublicEvent(payload, 'ar', publicSlug)
    expect(found?.title).toBe('Public listed event')
    expect(pathOf('events', { slug: 'talk' }, 'ar')).toBe('/ar/events/talk')
  })

  it('keeps image dimensions and variants available for responsive gallery rendering', async () => {
    const event = await getPublicEvent(payload, 'en', publicSlug)
    expect(event?.cover_image).toMatchObject({
      id: coverId,
      url: expect.any(String),
      alt: 'Event cover probe',
      width: expect.any(Number),
      height: expect.any(Number),
      sizes: expect.any(Object),
      mimeType: 'image/webp',
    })
  })
})

describe('eventItems', () => {
  const base = { kind: 'event' as const, title: 'A talk', href: '/events/a', type: 'talk' }

  it('places each meeting of a dated event', () => {
    expect(
      eventItems(3, base, {
        mode: 'single',
        start_date: '2026-03-03T00:00:00.000Z',
        start_time: '18:00',
        end_time: '20:00',
      }),
    ).toEqual([
      { ...base, key: 'e3-0', item: 'e3', date: '2026-03-03', start: '18:00', end: '20:00' },
    ])
  })

  it('places an event with no times on its day, and an event with no known day nowhere', () => {
    expect(eventItems(3, base, { start_date: '2026-03-03T00:00:00.000Z' })).toEqual([
      { ...base, key: 'e3-day', item: 'e3', date: '2026-03-03' },
    ])
    expect(
      eventItems(3, base, { start_date: '2026-03-03T00:00:00.000Z', start_precision: 'week' }),
    ).toEqual([])
  })
})
