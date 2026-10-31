import { describe, expect, it } from 'vitest'

import { buildIcs, cairoToUtc } from '@/lib/ics'

describe('cairoToUtc', () => {
  it('follows Cairo’s winter and summer offsets', () => {
    expect(cairoToUtc('2025-01-22', '18:00').toISOString()).toBe('2025-01-22T16:00:00.000Z') // UTC+2
    expect(cairoToUtc('2025-07-19', '19:00').toISOString()).toBe('2025-07-19T16:00:00.000Z') // UTC+3
  })
})

describe('buildIcs', () => {
  const now = new Date('2026-10-12T00:00:00Z')
  it('writes timed meetings in UTC and dayless ones as all-day', () => {
    const ics = buildIcs(
      [
        {
          uid: 'c1-0@cilas',
          title: 'Writing, Self; and More',
          date: '2025-07-19',
          start: '19:00',
          end: '21:30',
          url: 'https://ci-las.org/en/study/x',
        },
        { uid: 'c2-start@cilas', title: 'نكتب أنفسنا', date: '2025-07-20' },
      ],
      { name: 'CILAS', now },
    )
    expect(ics).toContain('DTSTART:20250719T160000Z\r\nDTEND:20250719T183000Z')
    expect(ics).toContain('SUMMARY:Writing\\, Self\\; and More')
    expect(ics).toContain('DTSTART;VALUE=DATE:20250720\r\nDTEND;VALUE=DATE:20250721')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75)).toBe(
      true,
    )
  })
})
