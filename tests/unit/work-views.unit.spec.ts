// @vitest-environment node

import type { TypedUser } from 'payload'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { workViewsFor } from '@/components/admin/work-views'

const as = (...roles: string[]) => ({ roles, person: 7 }) as unknown as TypedUser

describe('work views (top bar and dashboard tiles)', () => {
  it('shows admins Applicants, Reviews and Subscribers', () => {
    expect(workViewsFor(as('super_admin')).map((v) => v.key)).toEqual([
      'applicants',
      'reviews',
      'subscribers',
    ])
  })

  it('shows fellows Applicants only', () => {
    expect(workViewsFor(as('fellow')).map((v) => v.key)).toEqual(['applicants'])
  })

  it('hides Applicants from a fellow with no linked person', () => {
    const unlinked = { roles: ['fellow'] } as unknown as TypedUser
    expect(workViewsFor(unlinked)).toEqual([])
  })

  it('shows nobody else any view', () => {
    expect(workViewsFor(as('student'))).toEqual([])
    expect(workViewsFor(null)).toEqual([])
  })

  it('names Applicants in Arabic for an Arabic admin', () => {
    expect(workViewsFor(as('fellow'), 'ar')[0]?.label).toBe('المتقدمون')
  })
})
