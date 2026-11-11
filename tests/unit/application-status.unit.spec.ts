import { describe, expect, it } from 'vitest'
import { deriveStatus } from '@/forms/application-status'

const at = (decision: 'pending' | 'accepted' | 'rejected', decided_at: string | null = null) => ({
  decision,
  decided_at,
})

describe('submission status from course decisions', () => {
  it('is new while any course waits', () => {
    expect(deriveStatus([at('accepted', '2026-11-01T00:00:00Z'), at('pending')])).toEqual({
      status: 'new',
      decided_at: null,
    })
  })
  it('is new with no decisions at all, and for a missing decision', () => {
    expect(deriveStatus([])).toEqual({ status: 'new', decided_at: null })
    expect(deriveStatus([{ decided_at: null }])).toEqual({ status: 'new', decided_at: null })
  })
  it('is accepted once all are decided and any was accepted', () => {
    expect(
      deriveStatus([
        at('rejected', '2026-11-03T00:00:00Z'),
        at('accepted', '2026-11-02T00:00:00Z'),
      ]),
    ).toEqual({ status: 'accepted', decided_at: '2026-11-03T00:00:00Z' })
  })
  it('is rejected when every course is rejected', () => {
    expect(
      deriveStatus([
        at('rejected', '2026-11-02T00:00:00Z'),
        at('rejected', '2026-11-04T00:00:00Z'),
      ]),
    ).toEqual({ status: 'rejected', decided_at: '2026-11-04T00:00:00Z' })
  })
  it('takes the last decision time whatever the order', () => {
    expect(
      deriveStatus([at('accepted', '2026-11-09T00:00:00Z'), at('accepted', '2026-11-05T00:00:00Z')])
        .decided_at,
    ).toBe('2026-11-09T00:00:00Z')
  })
})
