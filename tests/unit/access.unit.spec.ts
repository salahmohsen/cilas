import type { Access, Where } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  canAuthor,
  isAdminOrOwn,
  isAdminOrOwnAndDraft,
  isAdminOrOwnVersions,
  isAdminOrOwnWhile,
  ownsViaAuthors,
  ownsViaFellows,
  ownsViaPerson,
  publishedOrAdmin,
  readTiers,
} from '@/access'
import type { User } from '@/payload-types'

const user = (roles: User['roles'], extra: Record<string, unknown> = {}): User =>
  ({ id: 7, email: 'probe@cilas.test', roles, ...extra }) as unknown as User

const run = (access: Access, u: User | null) => access({ req: { user: u } } as never)

describe('isAdminOrOwnAndDraft', () => {
  const rule = isAdminOrOwnAndDraft(ownsViaFellows, { allow: ['fellow'] })

  it('lets admins edit anything', () => {
    expect(run(rule, user(['admin']))).toBe(true)
  })

  it('refuses anonymous visitors', () => {
    expect(run(rule, null)).toBe(false)
  })

  it('refuses roles outside allow', () => {
    expect(run(rule, user(['non_degree_seeking']))).toBe(false)
  })

  it('keeps ownership AND draft for a fellow', () => {
    expect(run(rule, user(['fellow'], { person: 42 }))).toEqual({
      and: [{ fellows: { contains: 42 } }, { _status: { equals: 'draft' } }],
    })
  })

  it('refuses when ownership cannot be expressed', () => {
    const never = isAdminOrOwnAndDraft(() => false)
    expect(run(never, user(['fellow']))).toBe(false)
  })
})

describe('readTiers', () => {
  it('skips the owner branch when ownership cannot be expressed', () => {
    const rule = readTiers(() => false)
    expect(run(rule, user(['non_degree_seeking']))).toEqual({
      or: [{ tier: { in: ['community', 'public'] } }],
    })
  })
})

describe('ownsViaFellows', () => {
  it('owns through the linked person id', () => {
    expect(ownsViaFellows(user(['fellow'], { person: 42 }))).toEqual({
      fellows: { contains: 42 },
    })
  })

  it('accepts a populated person', () => {
    expect(ownsViaFellows(user(['fellow'], { person: { id: 42 } }))).toEqual({
      fellows: { contains: 42 },
    })
  })

  it('owns nothing without a linked person', () => {
    expect(ownsViaFellows(user(['fellow']))).toBe(false)
  })
})

describe('publishedOrAdmin', () => {
  it('lets admins read everything', () => {
    expect(run(publishedOrAdmin, user(['admin']))).toBe(true)
  })

  it('shows everyone else only published documents', () => {
    const published = { _status: { equals: 'published' } }
    expect(run(publishedOrAdmin, null)).toEqual(published)
    expect(run(publishedOrAdmin, user(['non_degree_seeking']))).toEqual(published)
  })
})

describe('isAdminOrOwn(ownsViaPerson)', () => {
  const rule = isAdminOrOwn(ownsViaPerson)

  it('lets admins through', () => {
    expect(run(rule, user(['admin']))).toBe(true)
  })

  it("limits a linked account to its person's rows", () => {
    expect(run(rule, user(['non_degree_seeking'], { person: 7 }))).toEqual({
      person: { equals: 7 },
    })
  })

  it('refuses anonymous and unlinked accounts', () => {
    expect(run(rule, null)).toBe(false)
    expect(run(rule, user(['non_degree_seeking'], { person: null }))).toBe(false)
  })
})

describe('ownsViaAuthors', () => {
  it("owns through the account's person", () => {
    expect(ownsViaAuthors(user(['member'], { person: 7 }))).toEqual({
      authors: { contains: 7 },
    })
  })

  it('owns nothing without a linked person', () => {
    expect(ownsViaAuthors(user(['member']))).toBe(false)
  })
})

describe('isAdminOrOwnVersions', () => {
  it('lets admins through', () => {
    expect(run(isAdminOrOwnVersions(ownsViaFellows), user(['admin']))).toBe(true)
  })

  it('prefixes the ownership constraint for the versions table', () => {
    expect(run(isAdminOrOwnVersions(ownsViaFellows), user(['member'], { person: 7 }))).toEqual({
      'version.fellows': { contains: 7 },
    })
    expect(run(isAdminOrOwnVersions(ownsViaAuthors), user(['member'], { person: 7 }))).toEqual({
      'version.authors': { contains: 7 },
    })
  })

  it('prefixes inside and/or and maps id to parent', () => {
    const owned = (): Where => ({ and: [{ id: { equals: 3 } }, { tier: { equals: 'owner' } }] })
    expect(run(isAdminOrOwnVersions(owned), user(['member'], { person: 7 }))).toEqual({
      and: [{ parent: { equals: 3 } }, { 'version.tier': { equals: 'owner' } }],
    })
  })

  it('refuses anonymous and unlinked accounts', () => {
    expect(run(isAdminOrOwnVersions(ownsViaFellows), null)).toBe(false)
    expect(run(isAdminOrOwnVersions(ownsViaFellows), user(['fellow'], { person: null }))).toBe(
      false,
    )
  })
})

describe('canAuthor', () => {
  it.each(['member', 'fellow', 'non_degree_seeking'] as const)(
    'lets a linked %s write articles',
    (role) => {
      expect(run(canAuthor, user([role], { person: 7 }))).toBe(true)
    },
  )

  it.each(['member', 'fellow', 'non_degree_seeking'] as const)(
    'refuses a %s with no linked person',
    (role) => {
      expect(run(canAuthor, user([role]))).toBe(false)
      expect(run(canAuthor, user([role], { person: null }))).toBe(false)
    },
  )

  it.each(['admin', 'super_admin'] as const)('lets a %s write without a person', (role) => {
    expect(run(canAuthor, user([role]))).toBe(true)
  })

  it('refuses a linked account with no role', () => {
    expect(run(canAuthor, user([], { person: 7 }))).toBe(false)
  })

  it('refuses anonymous visitors', () => {
    expect(run(canAuthor, null)).toBe(false)
  })
})

describe('isAdminOrOwnWhile', () => {
  const editable = { 'review.status': { in: ['draft', 'changes_requested'] } }
  const rule = isAdminOrOwnWhile(ownsViaAuthors, editable)

  it('lets admins through', () => {
    expect(run(rule, user(['admin']))).toBe(true)
  })

  it('refuses anonymous visitors', () => {
    expect(run(rule, null)).toBe(false)
  })

  it('keeps ownership AND the review condition for an author', () => {
    expect(run(rule, user(['member'], { person: 7 }))).toEqual({
      and: [{ authors: { contains: 7 } }, editable],
    })
  })

  it('refuses an account with no person', () => {
    expect(run(rule, user(['member']))).toBe(false)
  })
})
