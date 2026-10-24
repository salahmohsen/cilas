import { describe, expect, it } from 'vitest'

import { addDays, cairoDay, cairoInstant, weekdayOf } from '@/lib/cairo-day'

describe('cairoDay', () => {
  it('passes a plain day through', () => {
    expect(cairoDay('2026-03-03')).toBe('2026-03-03')
  })

  it('reads a timestamp as the Cairo calendar day', () => {
    // 22:00 UTC on 2 March is midnight on 3 March in Cairo (UTC+2).
    expect(cairoDay('2026-03-02T22:00:00.000Z')).toBe('2026-03-03')
    expect(cairoDay('2026-03-02T21:59:00.000Z')).toBe('2026-03-02')
  })

  it('is null for anything that is not a real day', () => {
    expect(cairoDay('garbage')).toBeNull()
    expect(cairoDay('2026-13-01')).toBeNull()
    expect(cairoDay('2026-02-30')).toBeNull()
    expect(cairoDay(new Date('nope'))).toBeNull()
  })

  it('accepts a Date', () => {
    expect(cairoDay(new Date('2026-03-01T21:30:00Z'))).toBe('2026-03-01')
  })
})

describe('addDays', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-03', 0)).toBe('2026-03-03')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('weekdayOf', () => {
  it('names the weekday', () => {
    expect(weekdayOf('2026-03-03')).toBe('tue')
    expect(weekdayOf('2026-03-07')).toBe('sat')
    expect(weekdayOf('2026-03-06')).toBe('fri')
    expect(weekdayOf('2026-03-08')).toBe('sun')
  })
})

describe('cairoInstant', () => {
  it('reads a Cairo wall-clock time in winter and in summer', () => {
    expect(cairoInstant('2026-01-15', '18:00')).toBe('2026-01-15T16:00:00.000Z')
    expect(cairoInstant('2026-07-01', '18:00')).toBe('2026-07-01T15:00:00.000Z')
  })

  it('refuses a day or a time that is not real', () => {
    expect(cairoInstant('2026-02-30', '10:00')).toBeNull()
    expect(cairoInstant('2026-03-01', '24:00')).toBeNull()
  })
})
