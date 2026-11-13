import { describe, expect, it } from 'vitest'

import { weekdayName, weeklyTimesText } from '@/lib/meeting-text'

const tue = { weekday: 'tue' as const, start_time: '19:00', end_time: '21:00' }
const thu = { weekday: 'thu' as const, start_time: '18:00', end_time: '20:00' }

describe('weekdayName', () => {
  it('names every weekday in each language', () => {
    expect(weekdayName('sat', 'en')).toBe('Saturday')
    expect(weekdayName('fri', 'en')).toBe('Friday')
    expect(weekdayName('tue', 'ar')).toBe('الثلاثاء')
  })
})

describe('weeklyTimesText', () => {
  it('writes a weekly time as the course page does', () => {
    expect(weeklyTimesText([tue], 'en')).toBe('Tuesday, 19:00–21:00')
    expect(weeklyTimesText([tue], 'ar')).toBe('الثلاثاء، ١٩:٠٠–٢١:٠٠')
  })

  it('separates several times with semicolons', () => {
    expect(weeklyTimesText([tue, thu], 'en')).toBe('Tuesday, 19:00–21:00; Thursday, 18:00–20:00')
    expect(weeklyTimesText([tue, thu], 'ar')).toBe('الثلاثاء، ١٩:٠٠–٢١:٠٠؛ الخميس، ١٨:٠٠–٢٠:٠٠')
  })

  it('writes the weekday alone for an all-day time', () => {
    expect(weeklyTimesText([{ weekday: 'mon', start_time: null, end_time: null }], 'en')).toBe(
      'Monday',
    )
  })
})
