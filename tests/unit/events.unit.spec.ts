import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Event } from '@/payload-types'
import { eventTiming, orderEvents, otherUpcomingEvents } from '@/lib/events'
import { getPublicEvents, getPublicEvent } from '@/api/events.api'
import { pathOf } from '@/lib/paths'
import { spaceEvents } from '@/lib/spaces-data'
import type { Space, User } from '@/payload-types'

const now = new Date('2026-10-28T16:30:00Z') // 19:30 in Cairo.
const scheduled = (id: number, start: string, weeks = 1): Event => ({
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
})

describe('public event timing', () => {
  it('restricts a Space’s public event query to published events even for admins', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    await spaceEvents(
      { find } as unknown as Payload,
      { id: -1, roles: ['admin'] } as User,
      { id: 1, kind: 'course', course: 2 } as Space,
    )
    expect(
      find.mock.calls.find(([query]) => query.collection === 'events')?.[0].where.and,
    ).toContainEqual({ _status: { equals: 'published' } })
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
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const payload = { find } as unknown as Payload
    await getPublicEvents(payload, 'en')
    await getPublicEvent(payload, 'ar', 'private-event')
    expect(find.mock.calls[0][0]).toMatchObject({
      overrideAccess: false,
      where: { and: [{ tier: { equals: 'public' } }] },
    })
    expect(find.mock.calls[1][0]).toMatchObject({
      overrideAccess: false,
      locale: 'ar',
      fallbackLocale: 'en',
      where: { and: [{ tier: { equals: 'public' } }, { slug: { equals: 'private-event' } }] },
    })
    expect(pathOf('events', { slug: 'talk' }, 'ar')).toBe('/ar/events/talk')
  })

  it('keeps image dimensions and variants available for responsive gallery rendering', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const payload = { find } as unknown as Payload
    await getPublicEvent(payload, 'en', 'gallery')
    expect(find.mock.calls[0][0].populate.media).toMatchObject({
      url: true,
      alt: true,
      width: true,
      height: true,
      sizes: true,
      mimeType: true,
    })
  })
})
