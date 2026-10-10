import { describe, expect, it } from 'vitest'

import { missingLinks, sessionMismatch, unitMarkers } from '../../migration/lib/verify-flows'
import type { Syllabus } from '../../migration/lib/syllabus-schema'

const syllabus = (hrefs: string[], bibHrefs: string[] = []): Syllabus => ({
  session_unit: 'week',
  sessions: [
    {
      order: 1,
      title: null,
      description: '',
      meetings: null,
      materials: hrefs.map((href) => ({ type: 'reading' as const, title: 't', note: null, href })),
      activities: [],
    },
  ],
  bibliography: bibHrefs.map((href) => ({ type: 'reading' as const, title: 't', note: null, href })),
  notes: null,
})

describe('missingLinks', () => {
  it('ignores trailing slashes and http/https', () => {
    expect(missingLinks(['https://a.org/x/', 'http://b.org'], syllabus(['http://a.org/x', 'https://b.org/']))).toEqual([])
  })

  it('reports the link that is absent', () => {
    expect(missingLinks(['https://a.org/x', 'https://c.org'], syllabus(['https://a.org/x/']))).toEqual(['https://c.org'])
  })

  it('counts course-level bibliography links', () => {
    expect(missingLinks(['https://c.org'], syllabus([], ['https://c.org']))).toEqual([])
  })
})

describe('unitMarkers', () => {
  it('counts distinct week markers', () => {
    expect(unitMarkers('Week 1\nWeek 2 text\nweek 2 again')).toBe(2)
  })

  it('counts Arabic unit markers', () => {
    expect(unitMarkers('الأسبوع الأول\nشيء\nالأسبوع الثاني')).toBe(2)
  })

  it('counts numbered lines', () => {
    expect(unitMarkers('1. a\n2. b\n3) c')).toBe(3)
  })

  it('returns the largest count', () => {
    expect(unitMarkers('Week 1\n1. a\n2. b\n3. c')).toBe(3)
  })
})

describe('sessionMismatch', () => {
  it('allows a difference of one', () => {
    expect(sessionMismatch(5, 4)).toBe(false)
    expect(sessionMismatch(5, 6)).toBe(false)
  })

  it('flags a bigger difference', () => {
    expect(sessionMismatch(5, 3)).toBe(true)
  })

  it('flags markers with no sessions', () => {
    expect(sessionMismatch(1, 0)).toBe(true)
  })

  it('does not flag a flow with no markers to compare against', () => {
    expect(sessionMismatch(0, 9)).toBe(false)
  })
})
