import { describe, expect, it } from 'vitest'

import { academicYear, cycleTitle } from '@/lib/cycle'

describe('cycleTitle', () => {
  it('names season, year and place', () => {
    expect(cycleTitle({ season: 'spring', start_year: 2026, place: 'Cairo' })).toBe(
      'Spring 2026, Cairo',
    )
  })

  it('leaves the place out when unknown', () => {
    expect(cycleTitle({ season: 'fall', start_year: 2025, place: null })).toBe('Fall 2025')
  })
})

describe('academicYear', () => {
  it('starts with fall when there is no start date', () => {
    expect(academicYear({ season: 'fall', start_year: 2025 })).toBe('2025–2026')
  })

  it('puts winter, spring and summer at the end of a year', () => {
    expect(academicYear({ season: 'winter', start_year: 2026 })).toBe('2025–2026')
    expect(academicYear({ season: 'spring', start_year: 2026 })).toBe('2025–2026')
    expect(academicYear({ season: 'summer', start_year: 2026 })).toBe('2025–2026')
  })

  it('follows the start date, with September as the boundary', () => {
    expect(academicYear({ season: 'summer', start_year: 2025, start_date: '2025-08-31' })).toBe(
      '2024–2025',
    )
    expect(academicYear({ season: 'fall', start_year: 2025, start_date: '2025-09-01' })).toBe(
      '2025–2026',
    )
  })

  it('reads a stored timestamp as its Cairo day', () => {
    // 22:00 UTC on 31 August 2025 is 1 September in Cairo (UTC+3).
    expect(
      academicYear({ season: 'fall', start_year: 2025, start_date: '2025-08-31T22:00:00.000Z' }),
    ).toBe('2025–2026')
  })

  it('falls back to the season when the date is not real', () => {
    expect(academicYear({ season: 'spring', start_year: 2026, start_date: 'nope' })).toBe(
      '2025–2026',
    )
  })
})
