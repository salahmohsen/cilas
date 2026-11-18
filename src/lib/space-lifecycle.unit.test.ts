import { describe, expect, it } from 'vitest'

import { courseLastMeeting } from '@/lib/space-lifecycle'
import { readOnly } from '@/lib/space-rules'

describe('space lifecycle (spec §11)', () => {
  it("the last meeting is the course's kept last day; none without one", () => {
    expect(courseLastMeeting({ last_day: '2026-09-22' })).toBe('2026-09-22')
    expect(courseLastMeeting({ last_day: null })).toBeNull()
    expect(courseLastMeeting({})).toBeNull()
  })

  it('read-only two weeks after the last meeting, unless reopened; cohort and community never', () => {
    expect(readOnly({ kind: 'course', reopened: false } as never, '2026-09-22', 2)).toBe(false)
    expect(readOnly({ kind: 'course', reopened: false } as never, '2026-09-22', 20)).toBe(true)
    expect(readOnly({ kind: 'course', reopened: true } as never, '2026-09-22', 30)).toBe(false)
    expect(readOnly({ kind: 'cohort' } as never, null, 999)).toBe(false)
    expect(readOnly({ kind: 'community' } as never, null, 999)).toBe(false)
  })
})
