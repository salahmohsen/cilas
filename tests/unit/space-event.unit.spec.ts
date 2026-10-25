import { describe, expect, it } from 'vitest'

import { eventOver, eventTitle, googleCalendarUrl, icsFor, locationUrl } from '@/lib/space-event'

describe('locationUrl', () => {
  it('reads one http or https address, and nothing else, as a link', () => {
    expect(locationUrl('https://meet.example.org/room?x=1')).toBe(
      'https://meet.example.org/room?x=1',
    )
    expect(locationUrl('  http://example.org  ')).toBe('http://example.org/')
    expect(locationUrl('Room 2, Zamalek')).toBeNull()
    expect(locationUrl('https://example.org join here')).toBeNull()
    expect(locationUrl('ftp://example.org')).toBeNull()
    expect(locationUrl('javascript:alert(1)')).toBeNull()
    expect(locationUrl('https://')).toBeNull()
    expect(locationUrl('')).toBeNull()
  })
})

describe('eventOver', () => {
  const now = new Date('2026-11-01T12:00:00Z')
  it('is over after the end, or after the start when there is no end', () => {
    expect(eventOver('2026-11-01T10:00:00Z', null, now)).toBe(true)
    expect(eventOver('2026-11-01T10:00:00Z', '2026-11-01T13:00:00Z', now)).toBe(false)
    expect(eventOver('2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z', now)).toBe(true)
    expect(eventOver('2026-11-02T10:00:00Z', null, now)).toBe(false)
  })
})

describe('calendar entries', () => {
  const event = {
    title: 'Reading circle, week 2',
    startsAt: '2026-11-01T16:00:00.000Z',
    endsAt: '2026-11-01T18:30:00.000Z',
    location: 'Room 2; Zamalek',
  }
  it('titles an event by the first line of the post, without markdown', () => {
    expect(eventTitle('## **Reading** circle\n\nmore', 'Event')).toBe('Reading circle')
    expect(eventTitle('   \n', 'Event')).toBe('Event')
  })
  it('builds a prefilled Google Calendar link in UTC', () => {
    const url = new URL(googleCalendarUrl(event))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('dates')).toBe('20261101T160000Z/20261101T183000Z')
    expect(url.searchParams.get('text')).toBe(event.title)
    expect(url.searchParams.get('location')).toBe(event.location)
  })
  it('gives an event without an end one hour', () => {
    const url = new URL(googleCalendarUrl({ ...event, endsAt: null }))
    expect(url.searchParams.get('dates')).toBe('20261101T160000Z/20261101T170000Z')
  })
  it('builds a valid iCalendar file with a stable UID and CRLF lines', () => {
    const now = new Date('2026-10-30T09:00:00Z')
    const ics = icsFor({ ...event, uid: 'space-post-7@cilas.org', url: 'https://x.org/p/7' }, now)
    const again = icsFor({ ...event, uid: 'space-post-7@cilas.org', url: 'https://x.org/p/7' }, now)
    expect(ics).toBe(again)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('UID:space-post-7@cilas.org\r\n')
    expect(ics).toContain('DTSTART:20261101T160000Z\r\n')
    expect(ics).toContain('DTEND:20261101T183000Z\r\n')
    expect(ics).toContain('LOCATION:Room 2\; Zamalek\r\n')
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true)
  })
  it('folds a long line at 75 octets', () => {
    const ics = icsFor({ ...event, uid: 'u', title: 'x'.repeat(200) })
    expect(ics).toContain('\r\n x')
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true)
  })
})
