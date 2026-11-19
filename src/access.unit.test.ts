import type { Access, TextField, Where } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  adminOrOwnAccountRows,
  adminPublishes,
  adminOnlyField,
  adminUpdates,
  adminWrites,
  adminViewOf,
  canAuthor,
  canProposePublication,
  canTeach,
  isAdminOrOwn,
  nobody,
  OWNER_EDITS,
  ownAccountRows,
  ownAccountWhere,
  ownList,
  ownsViaAuthors,
  ownsViaEditors,
  ownsViaFellows,
  ownsViaPerson,
  publishedOrAdmin,
  publishedOrOwn,
  readEnrollments,
  readTiers,
  signedInOwnAccountRows,
  throughRelation,
  WITH_OWNER,
} from '@/access'
import type { User } from '@/payload-types'

const user = (roles: User['roles'], extra: Record<string, unknown> = {}) =>
  ({ id: 7, email: 'probe@cilas.test', roles, ...extra }) as unknown as User

const run = (access: Access, u: User | null) => access({ req: { user: u } } as never)

describe('isAdminOrOwnAndDraft', () => {
  const rule = isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], draft: true })

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
    const never = isAdminOrOwn(() => false, { draft: true })
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
    expect(run(isAdminOrOwn(ownsViaFellows, { versions: true }), user(['admin']))).toBe(true)
  })

  it('prefixes the ownership constraint for the versions table', () => {
    expect(
      run(isAdminOrOwn(ownsViaFellows, { versions: true }), user(['member'], { person: 7 })),
    ).toEqual({
      'version.fellows': { contains: 7 },
    })
    expect(
      run(isAdminOrOwn(ownsViaAuthors, { versions: true }), user(['member'], { person: 7 })),
    ).toEqual({
      'version.authors': { contains: 7 },
    })
  })

  it('prefixes inside and/or and maps id to parent', () => {
    const owned = () => {
      const where: Where = { and: [{ id: { equals: 3 } }, { tier: { equals: 'owner' } }] }
      return where
    }
    expect(run(isAdminOrOwn(owned, { versions: true }), user(['member'], { person: 7 }))).toEqual({
      and: [{ parent: { equals: 3 } }, { 'version.tier': { equals: 'owner' } }],
    })
  })

  it('refuses anonymous and unlinked accounts', () => {
    expect(run(isAdminOrOwn(ownsViaFellows, { versions: true }), null)).toBe(false)
    expect(
      run(isAdminOrOwn(ownsViaFellows, { versions: true }), user(['fellow'], { person: null })),
    ).toBe(false)
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
  const rule = isAdminOrOwn(ownsViaAuthors, { while: editable })

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

describe('adminViewOf', () => {
  it.each([
    [['super_admin'], 'admin'],
    [['admin', 'fellow'], 'admin'],
    [['member', 'fellow'], 'fellow'],
    [['member'], 'student'],
    [['non_degree_seeking'], 'student'],
    [[], null],
  ] as const)('gives %j the %s view', (roles, view) => {
    expect(adminViewOf(user([...roles]))).toBe(view)
  })

  it('gives anonymous visitors no view', () => {
    expect(adminViewOf(null)).toBeNull()
  })
})

describe('adminPublishes', () => {
  const rule = adminPublishes(() => true)
  const publish = (u: User | null) =>
    rule({ req: { user: u }, data: { _status: 'published' } } as never)

  it('refuses a non-admin publish', () => {
    expect(publish(user(['fellow'], { person: 42 }))).toBe(false)
  })

  it('lets an admin publish', () => {
    expect(publish(user(['admin']))).toBe(true)
  })

  it('leaves draft saves to the wrapped rule', () => {
    expect(rule({ req: { user: user(['fellow']) }, data: { _status: 'draft' } } as never)).toBe(
      true,
    )
    expect(run(rule, user(['fellow']))).toBe(true)
  })
})

describe('readEnrollments', () => {
  it('lets admins read every enrollment', () => {
    expect(run(readEnrollments, user(['admin']))).toBe(true)
  })

  it('lets a student read only their own', () => {
    expect(run(readEnrollments, user(['member'], { person: 7 }))).toEqual({
      person: { equals: 7 },
    })
  })

  it('lets a fellow also read the enrollments in courses they teach', () => {
    expect(run(readEnrollments, user(['member', 'fellow'], { person: 42 }))).toEqual({
      or: [{ person: { equals: 42 } }, { 'course.fellows': { contains: 42 } }],
    })
  })

  it('refuses an account with no person', () => {
    expect(run(readEnrollments, user(['fellow']))).toBe(false)
  })
})

describe('ownList', () => {
  const filter = ownList(ownsViaFellows)
  const list = (u: User | null) => filter({ req: { user: u } } as never)

  it('does not filter for admins', () => {
    expect(list(user(['admin']))).toBeNull()
  })

  it('lists only what a fellow owns', () => {
    expect(list(user(['fellow'], { person: 42 }))).toEqual({ fellows: { contains: 42 } })
  })

  it('lists nothing for an account with no person', () => {
    expect(list(user(['fellow']))).toEqual({ id: { equals: 0 } })
  })
})

describe('publishedOrOwn', () => {
  const rule = publishedOrOwn(ownsViaEditors)
  const published = { _status: { equals: 'published' } }

  it('shows anonymous visitors what is published', () => {
    expect(run(rule, null)).toEqual(published)
  })

  it('also shows an editor their own drafts', () => {
    expect(run(rule, user(['member'], { person: 7 }))).toEqual({
      or: [published, { editors: { contains: 7 } }],
    })
  })

  it('lets admins read everything', () => {
    expect(run(rule, user(['admin']))).toBe(true)
  })
})

describe('canProposePublication', () => {
  it.each(['member', 'non_degree_seeking'] as const)('lets a linked %s propose', (role) => {
    expect(run(canProposePublication, user([role], { person: 7 }))).toBe(true)
  })

  it('lets a linked fellow propose; only an admin publishes', () => {
    expect(run(canProposePublication, user(['member', 'fellow'], { person: 7 }))).toBe(true)
  })

  it('refuses a fellow with no person', () => {
    expect(run(canProposePublication, user(['fellow']))).toBe(false)
  })

  it('refuses a student with no person', () => {
    expect(run(canProposePublication, user(['member']))).toBe(false)
  })
})

describe('canTeach', () => {
  it('lets admins and linked fellows propose a course', () => {
    expect(run(canTeach, user(['admin']))).toBe(true)
    expect(run(canTeach, user(['fellow'], { person: 7 }))).toBe(true)
  })

  it('refuses a fellow with no person, who could not reach the draft', () => {
    expect(run(canTeach, user(['fellow']))).toBe(false)
  })

  it('refuses members', () => {
    expect(run(canTeach, user(['member'], { person: 7 }))).toBe(false)
  })
})

describe('isAdminOrOwnAndDraft while with the owner', () => {
  it('lets an owner edit only a draft still with them, not one submitted', () => {
    const rule = isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], draft: true, while: WITH_OWNER })
    const where = run(rule, user(['fellow'], { person: 7 })) as Where
    expect(where).toEqual({
      and: [{ fellows: { contains: 7 } }, { _status: { equals: 'draft' } }, WITH_OWNER],
    })
    expect(WITH_OWNER).toEqual({ 'review.status': { in: ['draft', 'changes_requested'] } })
  })
})

describe('OWNER_EDITS', () => {
  it('lets an owner reach their drafts and published documents; the review hooks decide', () => {
    const rule = isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], while: OWNER_EDITS })
    expect(run(rule, user(['fellow'], { person: 7 }))).toEqual({
      and: [{ fellows: { contains: 7 } }, { _status: { in: ['draft', 'published'] } }],
    })
  })

  it('keeps the ownership path to the allowed roles', () => {
    const rule = isAdminOrOwn(ownsViaFellows, { allow: ['fellow'], while: OWNER_EDITS })
    expect(run(rule, user(['member'], { person: 7 }))).toBe(false)
  })
})

describe('throughRelation', () => {
  const via = throughRelation('course', readTiers(ownsViaFellows, { drafts: true }))

  it('passes a yes or no through', async () => {
    expect(await via({ req: { user: user(['admin']) } } as never)).toBe(true)
  })

  it('moves every constraint under the relationship, inside and/or too', async () => {
    expect(await via({ req: { user: null } } as never)).toEqual({
      and: [{ 'course.tier': { equals: 'public' } }, { 'course._status': { equals: 'published' } }],
    })
    expect(await via({ req: { user: user(['fellow'], { person: 3 }) } } as never)).toEqual({
      or: [
        {
          and: [
            { 'course.tier': { in: ['community', 'public'] } },
            { 'course._status': { equals: 'published' } },
          ],
        },
        { 'course.fellows': { contains: 3 } },
      ],
    })
  })
})

describe('rule names', () => {
  it('names a factory rule after the factory and its arguments', () => {
    expect(ownsViaAuthors.name).toBe('ownsVia(authors)')
    expect(isAdminOrOwn(ownsViaFellows, { versions: true }).name).toBe(
      'isAdminOrOwn(ownsVia(fellows),versions)',
    )
    expect(
      isAdminOrOwn(ownsViaEditors, { allow: ['member', 'fellow'], draft: true, while: WITH_OWNER })
        .name,
    ).toBe(
      'isAdminOrOwn(ownsVia(editors),allow=member|fellow,draft,while={"review.status":{"in":["draft","changes_requested"]}})',
    )
    expect(adminPublishes(canAuthor).name).toBe('adminPublishes(canAuthor)')
    expect(publishedOrOwn(ownsViaEditors).name).toBe('publishedOrOwn(ownsVia(editors))')
    expect(readTiers(undefined, { drafts: true }).name).toBe('readTiers(drafts)')
    expect(readTiers(ownsViaAuthors).name).toBe('readTiers(ownsVia(authors))')
    expect(throughRelation('course', readTiers(ownsViaFellows, { drafts: true })).name).toBe(
      'throughRelation(course,readTiers(ownsVia(fellows),drafts))',
    )
  })

  it('gives rules from different arguments different names', () => {
    expect(isAdminOrOwn(ownsViaAuthors, { while: OWNER_EDITS }).name).not.toBe(
      isAdminOrOwn(ownsViaAuthors, { while: WITH_OWNER }).name,
    )
    expect(isAdminOrOwn(ownsViaAuthors).name).not.toBe(isAdminOrOwn(ownsViaEditors).name)
  })

  it('prints an unnamed argument as anonymous, which the access audit refuses', () => {
    expect(adminPublishes(() => true).name).toBe('adminPublishes(anonymous)')
  })
})

describe('rule names', () => {
  it('give the same name for options in any order', () => {
    const a = isAdminOrOwn(ownsViaFellows, { draft: true, while: WITH_OWNER })
    const b = isAdminOrOwn(ownsViaFellows, { while: WITH_OWNER, draft: true })
    expect(a.name).toBe(b.name)
  })
})

describe('nobody', () => {
  it('refuses everyone', () => {
    expect(nobody()).toBe(false)
  })
})

describe('adminWrites and adminUpdates', () => {
  const own = () => 'own'
  const field = adminWrites<TextField>({
    name: 'legacy_url',
    type: 'text',
    access: { read: nobody },
    hooks: { beforeChange: [own], beforeDuplicate: [own] },
  })
  const keep = field.hooks!.beforeChange!.at(-1)!
  const run = (user: unknown, value: unknown, isRestoringVersion = true) =>
    keep({
      context: { isRestoringVersion },
      operation: 'update',
      previousValue: { stored: true },
      req: { user },
      value,
    } as never)

  it('lets only an admin write, and keeps the field rules and hooks it had', () => {
    expect(field.access).toEqual({ read: nobody, create: adminOnlyField, update: adminOnlyField })
    expect(field.hooks!.beforeChange![0]).toBe(own)
    expect(field.hooks!.beforeDuplicate).toEqual([own])
  })

  it('adminUpdates leaves create to the collection', () => {
    expect(adminUpdates<TextField>({ name: 'course', type: 'text' }).access).toEqual({
      update: adminOnlyField,
    })
  })

  it('a non-admin restore keeps a copy of the stored value', async () => {
    expect(await run({ roles: ['fellow'] }, undefined)).toEqual({ stored: true })
    expect(await run({ roles: ['fellow'] }, {})).toEqual({ stored: true })
  })

  it('an admin restore, or any other write, is left alone', async () => {
    expect(await run({ roles: ['admin'] }, 'old')).toBeUndefined()
    expect(await run({ roles: ['fellow'] }, 'given', false)).toBeUndefined()
  })
})

describe('own account rows', () => {
  const own = { account: { equals: 7 } }

  it('ownAccountWhere matches the account, or none without a user', () => {
    expect(ownAccountWhere(user(['member']))).toEqual(own)
    expect(ownAccountWhere(null)).toEqual({ account: { equals: null } })
  })

  it('ownAccountRows gives an anonymous reader no rows', () => {
    expect(run(ownAccountRows, null)).toEqual({ account: { equals: null } })
    expect(run(ownAccountRows, user(['member']))).toEqual(own)
  })

  it('signedInOwnAccountRows refuses an anonymous caller', () => {
    expect(run(signedInOwnAccountRows, null)).toBe(false)
    expect(run(signedInOwnAccountRows, user(['member']))).toEqual(own)
  })

  it('adminOrOwnAccountRows gives an admin every row and a member their own', () => {
    expect(run(adminOrOwnAccountRows, user(['admin']))).toBe(true)
    expect(run(adminOrOwnAccountRows, user(['member']))).toEqual(own)
    expect(run(adminOrOwnAccountRows, null)).toEqual({ account: { equals: null } })
  })
})
