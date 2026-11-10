import { describe, expect, it } from 'vitest'

import { eventEntries, eventIcs } from '@/lib/event-calendar'
import type { Event } from '@/payload-types'

const words = {
  speakers: 'Speakers',
  agenda: 'Agenda',
  admission: 'Attendance',
  online: 'Online',
  egp: 'EGP',
  free: 'Free',
}
const event = {
  id: 7,
  title: 'Screening',
  slug: 'screening',
  tier: 'public',
  event_type: 'screening',
  createdAt: '',
  updatedAt: '',
  schedule: {
    mode: 'single',
    start_date: '2026-12-10T12:00:00.000Z',
    start_time: '18:00',
    end_time: '21:00',
  },
  external_venue: { name: 'Venue', address: 'Street 1' },
  speakers: [{ person: { id: 1, name: 'Ada' }, role: 'Moderator' }],
  pricing: { options: [{ amount: 0, default: true }] },
} as unknown as Event

describe('event calendar', () => {
  it('writes the meeting with its place and full details', () => {
    const [entry] = eventEntries(event, 'https://cilas.org/en/events/screening', words)
    expect(entry).toMatchObject({ date: '2026-12-10', start: '18:00', end: '21:00' })
    expect(entry!.location).toBe('Venue, Street 1')
    expect(entry!.description).toContain('Speakers: Ada (Moderator)')
    expect(entry!.description).toContain('Attendance: Free')
    expect(entry!.description).toContain('https://cilas.org/en/events/screening')
  })

  it('makes an all-day entry for a date without a time, and nothing for an undated event', () => {
    const day = { ...event, schedule: { start_date: '2026-12-10T12:00:00.000Z' } } as Event
    expect(eventIcs(day, 'u', words)).toContain('DTSTART;VALUE=DATE:20261210')
    expect(eventIcs({ ...event, schedule: {} } as Event, 'u', words)).toBeNull()
  })
})
