import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Event } from '@/payload-types'
import { EventAttendance } from '@/components/events/event-attendance'

vi.mock('next-intl/server', async () => {
  const { createFormatter, createTranslator } = await import('next-intl')
  const { default: messages } = await import('../../messages/en.json')
  return {
    getFormatter: async () => createFormatter({ locale: 'en', timeZone: 'Africa/Cairo' }),
    getTranslations: async (namespace: 'Events' | 'Spaces') =>
      createTranslator({ locale: 'en', messages: messages[namespace] }),
  }
})
vi.mock('@/components/space/event-details', () => ({ EventWhen: () => null }))

const event: Event = {
  id: 1,
  title: 'Screening',
  slug: 'screening',
  tier: 'public',
  event_type: 'screening',
  createdAt: '',
  updatedAt: '',
  schedule: { start_date: '2026-10-31' },
}
const now = new Date('2026-10-28T12:00:00Z')
const render = async (value: Event = event, at = now) =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(await EventAttendance({ event: value, now: at, locale: 'en' })),
    'text/html',
  )

describe('event attendance details', () => {
  it('keeps an unknown time and admission explicit instead of inventing a schedule or a free walk-in policy', async () => {
    const page = await render()
    expect(page.body.textContent).toContain('Time to be announced')
    expect(page.body.textContent).toContain('Attendance details to be announced.')
    expect(page.querySelector('a.side-card-action')).toBeNull()
  })

  it('embeds the pinned Maps location with the same loading and privacy settings as Spaces', async () => {
    const page = await render({
      ...event,
      external_venue: {
        name: 'Venue',
        address: 'Street address',
        map_url: 'https://www.google.com/maps/place/Venue/!3d30.03!4d31.25',
      },
    })
    const map = page.querySelector('iframe')!
    expect(new URL(map.src).searchParams.get('q')).toBe('30.03,31.25')
    expect(map.title).toBe('Map of Venue')
    expect(map.getAttribute('loading')).toBe('lazy')
    expect(map.getAttribute('referrerpolicy')).toBe('no-referrer')
  })

  it('offers a valid external registration only while registration is open', async () => {
    const external = {
      ...event,
      registration: { method: 'external' as const, url: 'https://example.com/register' },
    }
    expect(
      (await render(external)).querySelector<HTMLAnchorElement>('a.side-card-action')?.href,
    ).toBe('https://example.com/register')
    const ended = await render(external, new Date('2026-11-02T12:00:00Z'))
    expect(ended.querySelector('a.side-card-action')).toBeNull()
    expect(ended.body.textContent).toContain('This event has ended')
  })

  it('does not render an unsafe registration URL or call incomplete registration closed', async () => {
    const page = await render({
      ...event,
      registration: { method: 'external', url: 'javascript:alert(1)' },
    })
    expect(page.querySelector('a.side-card-action')).toBeNull()
    expect(page.body.textContent).toContain('Attendance details to be announced.')
    expect(page.body.textContent).not.toContain('Registration is closed.')
  })
})

describe('event attendance calendar', () => {
  it('offers the event to a calendar only while it is upcoming', async () => {
    const page = await render()
    expect(page.querySelector('a[href="/en/events/screening/event.ics"]')).not.toBeNull()
    const ended = await render(event, new Date('2026-11-02T12:00:00Z'))
    expect(ended.querySelector('a[href$="event.ics"]')).toBeNull()
  })
})
