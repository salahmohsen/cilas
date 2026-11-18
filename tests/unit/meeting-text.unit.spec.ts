import { describe, expect, it } from 'vitest'

import { weekdayName } from '@/lib/meeting-text'

describe('weekdayName', () => {
  it('names every weekday in each language', () => {
    expect(weekdayName('sat', 'en')).toBe('Saturday')
    expect(weekdayName('fri', 'en')).toBe('Friday')
    expect(weekdayName('tue', 'ar')).toBe('الثلاثاء')
  })
})
