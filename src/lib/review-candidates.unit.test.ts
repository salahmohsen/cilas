import { describe, expect, expectTypeOf, it } from 'vitest'

import { gate } from '@/lib/review-candidates'
import type { User } from '@/payload-types'

const user = { id: 1 } as User

describe('gate', () => {
  it('gives a user a read under their own access', () => {
    expect(gate({ user })).toEqual({ user, overrideAccess: false })
    expectTypeOf(gate({ user })).toEqualTypeOf<{ user: User; overrideAccess: false }>()
  })

  it('gives an explicit admin server read no access check', () => {
    expect(gate({ user: null, server: 'admin' })).toEqual({ overrideAccess: true })
    expectTypeOf(gate({ user: null, server: 'admin' })).toEqualTypeOf<{ overrideAccess: true }>()
  })

  it('refuses a null user that is no admin server read, in the types and at run time', () => {
    const missing = null as User | null
    // @ts-expect-error a user that may be null is not a reader
    expect(() => gate({ user: missing })).toThrow(/admin server read/)
    // @ts-expect-error a null user needs `server: 'admin'`
    expect(() => gate({ user: null })).toThrow(/admin server read/)
  })
})
