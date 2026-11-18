import { JSDOM } from 'jsdom'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EventAttendanceBody } from '@/components/events/event-attendance'
import { detailPath } from '@/lib/paths'
import type { Event } from '@/payload-types'

import { serverFormatter, serverTranslator } from '../../../testing/fan4-server-intl.test-utils'
import { IntlProvider } from '../../../testing/intl.test-utils'

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
  new JSDOM(
    renderToStaticMarkup(
      <IntlProvider>
        {await EventAttendanceBody({
          event: value,
          now: at,
          locale: 'en',
          t: serverTranslator('Events'),
          spaces: serverTranslator('Spaces'),
          format: serverFormatter(),
        })}
      </IntlProvider>,
    ),
  ).window.document

describe('event attendance details', () => {
  it('keeps an unknown time explicit, and shows no attendance line for an open public event', async () => {
    const page = await render()
    expect(page.body.textContent).toContain('Time to be announced')
    expect(page.body.textContent).not.toContain('Attendance')
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
    expect(page.body.textContent).not.toContain('Registration is closed.')
  })
})

describe('event attendance calendar', () => {
  it('offers the event to a calendar only while it is upcoming', async () => {
    const page = await render()
    expect(page.body.textContent).toContain('Add to calendar')
    expect(detailPath('events', 'screening', 'en', 'event.ics')).toBe(
      '/en/events/screening/event.ics',
    )
    const ended = await render(event, new Date('2026-11-02T12:00:00Z'))
    expect(ended.body.textContent).not.toContain('Add to calendar')
  })
})

describe('event attendance section', () => {
  it('shows the price, and registration that is set up but closed', async () => {
    const priced = await render({
      ...event,
      pricing: { options: [{ amount: 100, default: true }] },
    } as Event)
    expect(priced.body.textContent).toContain('Attendance')
    expect(priced.body.textContent).toContain('100')
    const closed = await render({
      ...event,
      registration: { method: 'external', url: 'https://example.com', deadline: '2026-10-01' },
    } as Event)
    expect(closed.body.textContent).toContain('Registration is closed.')
  })
})
