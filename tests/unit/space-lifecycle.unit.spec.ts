// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { courseLastMeeting, readOnly } from '@/lib/space-lifecycle'

describe('space lifecycle (spec §11)', () => {
  it('the last non-cancelled meeting comes last', () => {
    const last = courseLastMeeting({
      schedule: {
        start_date: '2026-09-01',
        weeks: 4,
        slots: [{ weekday: 'tue', start_time: '18:00', end_time: '20:00' }],
      },
    } as never)
    expect(last).toBe('2026-09-22')
  })

  it('read-only two weeks after the last meeting, unless reopened; cohort and community never', () => {
    expect(readOnly({ kind: 'course', reopened: false } as never, '2026-09-22', 2)).toBe(false)
    expect(readOnly({ kind: 'course', reopened: false } as never, '2026-09-22', 20)).toBe(true)
    expect(readOnly({ kind: 'course', reopened: true } as never, '2026-09-22', 30)).toBe(false)
    expect(readOnly({ kind: 'cohort' } as never, null, 999)).toBe(false)
    expect(readOnly({ kind: 'community' } as never, null, 999)).toBe(false)
  })
})
