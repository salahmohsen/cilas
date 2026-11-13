import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addDays,
  cairoNow,
  formatDay,
  formatMinutes,
  toMinutes,
  toTime,
  weekOf,
  weekStartOf,
} from '@/components/calendar/ui/calendar-time'
import { Temporal } from '@/components/calendar/ui/temporal'

afterEach(() => vi.useRealTimers())

describe('weeks start on Saturday', () => {
  it.each([
    ['2026-11-14', '2026-11-14'], // Saturday
    ['2026-11-15', '2026-11-14'], // Sunday
    ['2026-11-17', '2026-11-14'], // Tuesday
    ['2026-11-20', '2026-11-14'], // Friday, the last day
    ['2026-11-21', '2026-11-21'], // next Saturday
    ['2027-01-01', '2026-12-26'], // across a year
  ])('%s belongs to the week of %s', (day, start) => {
    expect(weekStartOf(day)).toBe(start)
  })

  it('lists seven days from Saturday to Friday', () => {
    expect(weekOf('2026-11-14')).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
    ])
  })

  it('adds days across a month, a leap day and a daylight-saving change', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-04-23', 2)).toBe('2026-04-25')
    expect(addDays('2026-10-28', -1)).toBe('2026-10-27')
  })
})

describe('times', () => {
  it('converts between HH:MM and minutes', () => {
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes('19:15')).toBe(1155)
    expect(toTime(1155)).toBe('19:15')
    expect(toTime(5)).toBe('00:05')
    expect(toTime(23 * 60 + 45)).toBe('23:45')
  })

  it('refuses a time that is not on the clock', () => {
    expect(() => toMinutes('25:00')).toThrow()
    expect(() => toTime(24 * 60)).toThrow()
  })
})

describe('now in Cairo', () => {
  it('reads the Cairo day and minute, not the machine zone', () => {
    // 22:30 UTC on 14 Nov is 00:30 on 15 Nov in Cairo (UTC+2 in winter).
    vi.useFakeTimers({ now: new Date('2026-11-14T22:30:00Z') })
    expect(cairoNow()).toEqual({ date: '2026-11-15', minutes: 30 })
  })

  it('follows summer time, UTC+3', () => {
    vi.useFakeTimers({ now: new Date('2026-07-01T21:15:00Z') })
    expect(cairoNow()).toEqual({ date: '2026-07-02', minutes: 15 })
  })

  it('takes any instant', () => {
    expect(cairoNow(Temporal.Instant.from('2026-11-17T10:05:00Z'))).toEqual({
      date: '2026-11-17',
      minutes: 725,
    })
  })

  it('jumps over the hour the clock skips', () => {
    // Egypt goes from 23:59 on 23 April to 01:00 on 24 April 2026, at 22:00 UTC.
    expect(cairoNow(Temporal.Instant.from('2026-04-23T21:59:00Z'))).toEqual({
      date: '2026-04-23',
      minutes: 23 * 60 + 59,
    })
    expect(cairoNow(Temporal.Instant.from('2026-04-23T22:00:00Z'))).toEqual({
      date: '2026-04-24',
      minutes: 60,
    })
  })

  it('shows the same minutes twice in the hour the clock repeats', () => {
    // Egypt repeats 23:00 to 24:00 on 29 October 2026: UTC+3 until 21:00 UTC, then UTC+2.
    const first = cairoNow(Temporal.Instant.from('2026-10-29T20:30:00Z'))
    const second = cairoNow(Temporal.Instant.from('2026-10-29T21:30:00Z'))
    expect(first).toEqual({ date: '2026-10-29', minutes: 23 * 60 + 30 })
    expect(second).toEqual(first)
  })
})

describe('formatting', () => {
  it('writes 24-hour and 12-hour times', () => {
    expect(formatMinutes(19 * 60 + 15, 'en', false)).toBe('19:15')
    expect(formatMinutes(9 * 60, 'en', false)).toBe('09:00')
    expect(formatMinutes(19 * 60 + 15, 'en', true)).toBe('7:15 PM')
    expect(formatMinutes(19 * 60, 'en', true, true)).toMatch(/^7\s?PM$/)
  })

  it('writes Arabic pages in Arabic-Indic digits, as the site does', () => {
    expect(formatMinutes(19 * 60 + 15, 'ar', false)).toBe('١٩:١٥')
    expect(formatDay('2026-11-17', 'ar', { day: 'numeric' })).toBe('١٧')
  })

  it('writes a day by its calendar date in any machine zone', () => {
    expect(formatDay('2026-11-17', 'en', { weekday: 'long', day: 'numeric', month: 'long' })).toBe(
      'Tuesday, November 17',
    )
  })
})

describe('without a native Temporal', () => {
  it('loads the polyfill and gives the same answers', async () => {
    vi.stubGlobal('Temporal', undefined)
    vi.resetModules()
    const time = await import('@/components/calendar/ui/calendar-time')
    expect(time.weekStartOf('2026-11-17')).toBe('2026-11-14')
    expect(time.toTime(1155)).toBe('19:15')
    expect(time.formatMinutes(1155, 'ar', false)).toBe('١٩:١٥')
  })
})
