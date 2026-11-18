import { within } from '@testing-library/react'
import { JSDOM } from 'jsdom'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PublicEventCardBody } from '@/components/events/public-event-card'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import type { Event } from '@/payload-types'

import { serverFormatter, serverTranslator } from '../../testing/fan4-server-intl.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'

mockNetwork()

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

const markup = (html: string) => {
  const root = new JSDOM('<div></div>').window.document.body.firstElementChild!
  root.innerHTML = html
  return root as HTMLElement
}

const words = {
  t: serverTranslator('Events'),
  types: serverTranslator('Calendar.eventTypes'),
  format: serverFormatter(),
  locale: 'en',
}

const card = async (data: Event) =>
  markup(renderToStaticMarkup(PublicEventCardBody({ event: data, now, ...words })))

describe('public event posters', () => {
  it('shows the same time for a single screening without an agenda as for a legacy timed event', async () => {
    const legacy = await card(event)
    const single = await card({
      ...event,
      agenda: [],
      schedule: {
        mode: 'single',
        start_date: '2026-11-04',
        start_time: '19:00',
        end_time: '20:00',
      },
    })
    expect(single.textContent).toBe(legacy.textContent)
  })
  it('uses the same poster layout and a distinct fixed color for every event type', async () => {
    const colors = Object.values(EVENT_POSTER_COLORS)
    expect(new Set(colors).size).toBe(colors.length)
    for (const event_type of Object.keys(EVENT_POSTER_COLORS) as Event['event_type'][]) {
      const document = await card({ ...event, event_type })
      const poster = within(document).getByRole('article')
      expect(poster.dataset.layout).toBe('1')
      expect(poster.style.getPropertyValue('--poster-color')).toBe(EVENT_POSTER_COLORS[event_type])
      expect(within(document).getByRole('heading', { level: 3 }).getAttribute('aria-label')).toBe(
        event.title,
      )
      expect(within(document).getByRole('link', { name: event.title }).getAttribute('href')).toBe(
        '/en/events/public-gathering',
      )
    }
  })

  it('keeps Cairo dates, time ranges, venue links, and online links', async () => {
    const document = await card({
      ...event,
      external_venue: { name: 'Guest venue', map_url: 'https://example.com/map' },
      online_url: 'https://example.com/meeting',
    })
    expect(document.textContent).toContain('Nov 4, 2026')
    expect(document.textContent).not.toContain('Cairo time')
    expect(document.textContent).toContain('7:00')
    const links = within(document)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href')?.startsWith('https://example.com/'))
    expect(Array.from(links, (link) => link.getAttribute('href'))).toEqual([
      'https://example.com/map',
      'https://example.com/meeting',
    ])
    expect(links[0]?.textContent?.trim()).toBe('Guest venue')
    expect(document.textContent).toContain('View event')
  })

  it('uses a logo for missing covers and omits an empty venue box', async () => {
    const document = await card(event)
    expect(within(document).queryByRole('img')).toBeNull()
    expect(within(document).getAllByRole('link')).toHaveLength(1)
  })

  it('frames the main image around its focal point instead of cropping a portrait variant again', async () => {
    const document = await card({
      ...event,
      cover_image: {
        id: 1,
        alt: 'Event cover',
        createdAt: '',
        updatedAt: '',
        url: '/assets/images/original.webp',
        focalX: 0,
        focalY: 85,
        sizes: { card: { url: '/assets/images/portrait.webp' } },
      },
    })
    const image = within(document).getByRole<HTMLImageElement>('img', { name: 'Event cover' })
    expect(image.style.objectPosition).toBe('0% 85%')
    const url = new URL(image.getAttribute('src')!, 'http://localhost:3000')
    expect(url.searchParams.get('url') ?? url.pathname).toBe('/assets/images/original.webp')
  })

  it('labels undated and past events explicitly', async () => {
    const undated = await card({ ...event, schedule: {} })
    expect(undated.textContent).toContain('Date to be announced')
    const past = await card({ ...event, schedule: { start_date: '2026-10-01' } })
    expect(within(past).getByText('This event has ended').textContent).toBe('This event has ended')
    expect(within(undated).queryByText('This event has ended')).toBeNull()
  })

  it('uses the article reader title and leaves the cover out of the event page', async () => {
    const result = PublicEventCardBody({
      ...words,
      showFacts: false,
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
    const document = markup(renderToStaticMarkup(result))
    expect(within(document).getByRole('heading', { level: 1 }).textContent).toBe(event.title)
    expect(document.querySelector('img')).toBeNull()
  })
})
