import { describe, expect, it } from 'vitest'

import { cairoClock, digestsDueAt, hourStart } from '@/lib/space-email-schedule'

// Egypt keeps daylight saving: UTC+3 from the last Friday of April to the last
// Thursday of October, UTC+2 otherwise. 16:00 Cairo is 13:00Z in summer and 14:00Z in winter.
describe('digest timing', () => {
  it('sends at 16:00 Cairo in winter (14:00 UTC)', () => {
    expect(digestsDueAt(new Date('2026-11-09T14:05:00Z'))).toEqual(['daily']) // Monday
    expect(digestsDueAt(new Date('2026-11-09T13:55:00Z'))).toEqual([])
    expect(digestsDueAt(new Date('2026-11-09T15:00:00Z'))).toEqual([])
  })

  it('sends at 16:00 Cairo in summer (13:00 UTC)', () => {
    expect(digestsDueAt(new Date('2026-08-03T13:05:00Z'))).toEqual(['daily']) // Monday
    expect(digestsDueAt(new Date('2026-08-03T14:05:00Z'))).toEqual([])
    expect(digestsDueAt(new Date('2026-08-03T12:59:00Z'))).toEqual([])
  })

  it('adds the weekly digest on Sunday only', () => {
    expect(digestsDueAt(new Date('2026-11-08T14:05:00Z'))).toEqual(['daily', 'weekly'])
    expect(digestsDueAt(new Date('2026-08-02T13:05:00Z'))).toEqual(['daily', 'weekly'])
    for (const day of ['09', '10', '11', '12', '13', '14'])
      expect(digestsDueAt(new Date(`2026-11-${day}T14:05:00Z`))).toEqual(['daily'])
  })

  it('follows the Cairo date, not the UTC one, near midnight', () => {
    // 22:30Z on Saturday is already 00:30 Sunday in Cairo (winter), but not 16:00.
    expect(cairoClock(new Date('2026-11-07T22:30:00Z'))).toEqual({ hour: 0, weekday: 'Sun' })
  })

  it('moves the window across both daylight-saving changes', () => {
    // Spring forward (Friday 24 April 2026): 14:00Z is 17:00 after, 16:00 before.
    expect(digestsDueAt(new Date('2026-04-23T14:05:00Z'))).toEqual(['daily'])
    expect(digestsDueAt(new Date('2026-04-25T13:05:00Z'))).toEqual(['daily'])
    // Fall back (Thursday 29 October 2026, 24:00 -> 23:00).
    expect(digestsDueAt(new Date('2026-10-28T13:05:00Z'))).toEqual(['daily'])
    expect(digestsDueAt(new Date('2026-10-30T14:05:00Z'))).toEqual(['daily'])
  })

  it('names the hour a claim belongs to', () => {
    expect(hourStart(new Date('2026-11-08T14:05:33.123Z')).toISOString()).toBe(
      '2026-11-08T14:00:00.000Z',
    )
  })
})
