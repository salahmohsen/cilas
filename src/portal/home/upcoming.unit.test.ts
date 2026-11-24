import { describe, expect, it } from 'vitest'

import type { CalendarMeeting } from '@/lib/calendar'

import { upcoming } from './upcoming'

const meeting = (key: string, date: string, start?: string, cancelled?: true) =>
  ({ key, date, start, cancelled }) as CalendarMeeting

const cairo1800 = new Date('2034-01-10T16:00:00Z')

describe('upcoming', () => {
  it('skips a session that started earlier today and takes the next one', () => {
    const found = upcoming(
      [meeting('earlier', '2034-01-10', '09:00'), meeting('tomorrow', '2034-01-11', '09:00')],
      cairo1800,
    )
    expect(found?.key).toBe('tomorrow')
  })

  it('takes a session that starts at the instant, and one later today', () => {
    expect(upcoming([meeting('now', '2034-01-10', '18:00')], cairo1800)?.key).toBe('now')
    expect(upcoming([meeting('later', '2034-01-10', '19:30')], cairo1800)?.key).toBe('later')
    expect(upcoming([meeting('a minute ago', '2034-01-10', '17:59')], cairo1800)).toBeUndefined()
  })

  it('skips a cancelled session', () => {
    const found = upcoming(
      [meeting('off', '2034-01-10', '19:00', true), meeting('on', '2034-01-12', '19:00')],
      cairo1800,
    )
    expect(found?.key).toBe('on')
  })

  it('holds a session with no start time for its whole Cairo day', () => {
    expect(upcoming([meeting('all day', '2034-01-10')], cairo1800)?.key).toBe('all day')
    expect(upcoming([meeting('yesterday', '2034-01-09')], cairo1800)).toBeUndefined()
  })

  it('reads the day in Cairo, not in UTC', () => {
    const late = new Date('2034-01-10T22:30:00Z')
    const found = upcoming(
      [meeting('past', '2034-01-10', '23:30'), meeting('next', '2034-01-11', '10:00')],
      late,
    )
    expect(found?.key).toBe('next')
  })

  it('gives nothing for no meeting', () => {
    expect(upcoming([], cairo1800)).toBeUndefined()
  })
})
