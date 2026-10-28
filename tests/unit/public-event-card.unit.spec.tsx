import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PublicEventCard } from '@/components/events/public-event-card'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import { publicEventCoverTone } from '@/lib/public-event-cover'
import type { Event } from '@/payload-types'

vi.mock('next-intl/server', async () => {
  const { createFormatter } = await import('next-intl')
  const { default: messages } = await import('../../messages/en.json')
  return {
    getLocale: async () => 'en',
    getFormatter: async () => createFormatter({ locale: 'en', timeZone: 'Africa/Cairo' }),
    getTranslations: async (namespace: string) => {
      const values: Record<string, string> =
        namespace === 'Events' ? messages.Events : messages.Calendar.eventTypes
      return (key: string) => values[key] ?? key
    },
  }
})
vi.mock('@/lib/public-event-cover', () => ({ publicEventCoverTone: vi.fn() }))
vi.mock('@/components/space/event-details', () => ({
  EventFace: () => null,
  EventPlace: () => null,
  EventWhen: () => null,
}))

const now = new Date('2026-10-28T12:00:00Z')
const event: Event = {
  id: 1,
  title: 'A public gathering',
  slug: 'public-gathering',
  tier: 'public',
  event_type: 'talk',
  createdAt: '',
  updatedAt: '',
  schedule: {
    start_date: '2026-11-04',
    weeks: 1,
    slots: [{ weekday: 'wed', start_time: '19:00', end_time: '20:00' }],
  },
}

const card = async (data: Event) =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(await PublicEventCard({ event: data, now })),
    'text/html',
  )

beforeEach(() => vi.clearAllMocks())

describe('public event posters', () => {
  it('uses the same poster layout and a distinct fixed color for every event type', async () => {
    const colors = Object.values(EVENT_POSTER_COLORS)
    expect(new Set(colors).size).toBe(colors.length)
    for (const event_type of Object.keys(EVENT_POSTER_COLORS) as Event['event_type'][]) {
      const document = await card({ ...event, event_type })
      const poster = document.querySelector<HTMLElement>('.poster')!
      expect(poster.dataset.layout).toBe('1')
      expect(poster.style.getPropertyValue('--poster-color')).toBe(EVENT_POSTER_COLORS[event_type])
      expect(document.querySelector('h3')?.getAttribute('aria-label')).toBe(event.title)
      expect(document.querySelector('.poster-link')?.getAttribute('href')).toBe(
        '/en/events/public-gathering',
      )
    }
    expect(publicEventCoverTone).not.toHaveBeenCalled()
  })

  it('keeps Cairo dates, time ranges, venue links, and online links', async () => {
    const document = await card({
      ...event,
      external_venue: { name: 'Guest venue', map_url: 'https://example.com/map' },
      online_url: 'https://example.com/meeting',
    })
    expect(document.querySelector('.poster-meta')?.textContent).toContain('Nov 4, 2026')
    expect(document.querySelector('.poster-meta')?.textContent).not.toContain('Cairo time')
    expect(document.querySelector('.poster-meta')?.textContent).toContain('7:00')
    const links = document.querySelectorAll('.poster-detail-link')
    expect(Array.from(links, (link) => link.getAttribute('href'))).toEqual([
      'https://example.com/map',
      'https://example.com/meeting',
    ])
    expect(links[0]?.textContent?.trim()).toBe('Guest venue')
    expect(document.querySelector('.poster-action')?.textContent).toContain('View event')
  })

  it('uses a logo for missing covers and omits an empty venue box', async () => {
    const document = await card(event)
    expect(document.querySelector('.poster-image')?.getAttribute('data-fallback')).toBe('logo')
    expect(document.querySelectorAll('.poster-fallback-logo path')).toHaveLength(7)
    expect(document.querySelector('.poster-image img')).toBeNull()
    expect(document.querySelector('.poster-details')).toBeNull()
  })

  it('frames the main image around its focal point instead of cropping a portrait variant again', async () => {
    const document = await card({
      ...event,
      cover_image: {
        id: 1, alt: 'Event cover', createdAt: '', updatedAt: '',
        url: '/assets/images/original.webp', focalX: 0, focalY: 85,
        sizes: { card: { url: '/assets/images/portrait.webp' } },
      },
    })
    const image = document.querySelector<HTMLImageElement>('.poster-image img')!
    expect(image.style.objectPosition).toBe('0% 85%')
    const url = new URL(image.getAttribute('src')!, 'http://localhost:3000')
    expect(url.searchParams.get('url') ?? url.pathname).toBe('/assets/images/original.webp')
  })

  it('labels undated and past events explicitly', async () => {
    const undated = await card({ ...event, schedule: {} })
    expect(undated.querySelector('.poster-meta')?.textContent).toContain('Date to be announced')
    const past = await card({ ...event, schedule: { start_date: '2026-10-01' } })
    expect(past.querySelector('.poster-status')?.textContent).toBe('This event has ended')
    expect(past.querySelector('.poster-meta')?.textContent).not.toContain('This event has ended')
    expect(undated.querySelector('.poster-status')).toBeNull()
  })

  it('uses the article reader title and leaves the cover out of the event page', async () => {
    const result = await PublicEventCard({
      event: {
        ...event,
        cover_image: {
          id: 1,
          alt: 'Event cover',
          createdAt: '',
          updatedAt: '',
          url: '/assets/images/original.jpg',
          sizes: { card: { url: '/assets/images/card.jpg' } },
        },
      },
      now,
      detail: true,
    })
    const document = new DOMParser().parseFromString(renderToStaticMarkup(result), 'text/html')
    expect(document.querySelector('h1')?.textContent).toBe(event.title)
    expect(document.querySelector('h1')?.classList.contains('article-title')).toBe(true)
    expect(document.querySelector('img')).toBeNull()
    expect(publicEventCoverTone).not.toHaveBeenCalled()
  })
})
