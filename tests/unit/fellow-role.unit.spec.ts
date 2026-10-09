import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { propagateFellowRole, revokeDeletedCourseFellows } from '@/collections/Courses'
import type { Course, User } from '@/payload-types'

type Role = User['roles'][number]
type Account = { id: number; person: number | null; roles: Role[] }

type FindArgs = {
  collection: string
  where: {
    person?: { equals: number }
    and?: Array<{ fellows: { contains: number } }>
  }
}

/**
 * The two payload calls the hooks make, stubbed:
 *   find users   -> the account linked to a person
 *   find courses -> whether that person is still listed on another course
 * `teaching` is the set of person ids listed on some other course.
 */
const stubPayload = (accounts: Account[], teaching: number[] = []) => {
  const updates: Array<{ id: number; data: { roles: Role[] } }> = []

  const payload = {
    find: vi.fn(async ({ collection, where }: FindArgs) => {
      if (collection === 'users') {
        const docs = accounts.filter((a) => a.person === where.person?.equals)
        return { docs, totalDocs: docs.length }
      }
      const person = where.and?.[0].fellows.contains ?? -1
      return { docs: [], totalDocs: teaching.includes(person) ? 1 : 0 }
    }),
    update: vi.fn(async ({ id, data }: { id: number; data: { roles: Role[] } }) => {
      updates.push({ id, data })
      const account = accounts.find((a) => a.id === id)
      if (account) account.roles = data.roles
      return { id, ...data }
    }),
  }

  return { payload: payload as unknown as Payload, updates }
}

const course = (id: number, fellows: Array<number | { id: number }>): Course =>
  ({ id, fellows }) as unknown as Course

type ChangeArgs = Parameters<typeof propagateFellowRole>[0]

const onChange = (payload: Payload, doc: Course, previousDoc: Course): ChangeArgs =>
  ({
    collection: {},
    context: {},
    data: {},
    doc,
    previousDoc,
    operation: 'update',
    overrideAccess: true,
    req: { payload },
  }) as unknown as ChangeArgs

type DeleteArgs = Parameters<typeof revokeDeletedCourseFellows>[0]

const onDelete = (payload: Payload, doc: Course): DeleteArgs =>
  ({
    collection: {},
    context: {},
    data: {},
    doc,
    previousDoc: doc,
    req: { payload },
  }) as unknown as DeleteArgs

// Person 50 is linked to account 5.
const linked = (roles: Role[]): Account[] => [{ id: 5, person: 50, roles }]

describe('propagateFellowRole', () => {
  it('grants fellow to the account of a newly listed person', async () => {
    const { payload, updates } = stubPayload(linked(['member']))

    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member', 'fellow'] } }])
  })

  it('does nothing for a person with no account', async () => {
    const { payload, updates } = stubPayload([])

    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))

    expect(updates).toEqual([])
  })

  it('does not duplicate a role the account already holds', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']))

    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))

    expect(updates).toEqual([])
  })

  it('keeps every other role when granting', async () => {
    const { payload, updates } = stubPayload(linked(['super_admin']))

    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [])))

    expect(updates[0].data.roles).toEqual(['super_admin', 'fellow'])
  })

  it('revokes fellow when removed from their only course', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']))

    await propagateFellowRole(onChange(payload, course(1, []), course(1, [50])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('keeps fellow when still listed on another course', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']), [50])

    await propagateFellowRole(onChange(payload, course(1, []), course(1, [50])))

    expect(updates).toEqual([])
  })

  it('falls back to member when fellow was the only role', async () => {
    const { payload, updates } = stubPayload(linked(['fellow']))

    await propagateFellowRole(onChange(payload, course(1, []), course(1, [50])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('ignores a save that changes nothing', async () => {
    const { payload, updates } = stubPayload(linked(['fellow']))

    await propagateFellowRole(onChange(payload, course(1, [50]), course(1, [50])))

    expect(updates).toEqual([])
  })

  it('accepts fellows as populated people, not just ids', async () => {
    const { payload, updates } = stubPayload(linked(['member']))

    await propagateFellowRole(onChange(payload, course(1, [{ id: 50 }]), course(1, [])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member', 'fellow'] } }])
  })
})

describe('revokeDeletedCourseFellows', () => {
  it('revokes fellow when the course is deleted', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']))

    await revokeDeletedCourseFellows(onDelete(payload, course(1, [50])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('keeps fellow when another course still lists them', async () => {
    const { payload, updates } = stubPayload(linked(['member', 'fellow']), [50])

    await revokeDeletedCourseFellows(onDelete(payload, course(1, [50])))

    expect(updates).toEqual([])
  })
})
