import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { propagateFellowRole, revokeDeletedCourseFellows } from '@/collections/Courses'
import type { Course, User } from '@/payload-types'

type Role = User['roles'][number]

/**
 * The three payload calls the hooks make, stubbed. `listedElsewhere` is the set
 * of fellow ids still listed on some course, so it drives the "is this their
 * only course" decision without touching a database.
 */
const stubPayload = (users: Record<number, Role[]>, listedElsewhere: number[] = []) => {
  const updates: Array<{ id: number; data: { roles: Role[] } }> = []

  const payload = {
    findByID: vi.fn(async ({ id }: { id: number }) => ({ id, roles: users[id] ?? [] })),
    find: vi.fn(async ({ where }: { where: { and: Array<{ fellows: { contains: number } }> } }) => ({
      docs: [],
      totalDocs: listedElsewhere.includes(where.and[0].fellows.contains) ? 1 : 0,
    })),
    update: vi.fn(async ({ id, data }: { id: number; data: { roles: Role[] } }) => {
      updates.push({ id, data })
      users[id] = data.roles
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

describe('propagateFellowRole', () => {
  it('grants fellow to someone newly listed', async () => {
    const { payload, updates } = stubPayload({ 5: ['member'] })

    await propagateFellowRole(onChange(payload, course(1, [5]), course(1, [])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member', 'fellow'] } }])
  })

  it('does not duplicate a role the user already holds', async () => {
    const { payload, updates } = stubPayload({ 5: ['member', 'fellow'] })

    await propagateFellowRole(onChange(payload, course(1, [5]), course(1, [])))

    expect(updates).toEqual([])
  })

  it('keeps every other role when granting', async () => {
    const { payload, updates } = stubPayload({ 5: ['super_admin'] })

    await propagateFellowRole(onChange(payload, course(1, [5]), course(1, [])))

    expect(updates[0].data.roles).toEqual(['super_admin', 'fellow'])
  })

  it('revokes fellow when removed from their only course', async () => {
    const { payload, updates } = stubPayload({ 5: ['member', 'fellow'] })

    await propagateFellowRole(onChange(payload, course(1, []), course(1, [5])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('keeps fellow when still listed on another course', async () => {
    const { payload, updates } = stubPayload({ 5: ['member', 'fellow'] }, [5])

    await propagateFellowRole(onChange(payload, course(1, []), course(1, [5])))

    expect(updates).toEqual([])
  })

  it('falls back to member when fellow was the only role', async () => {
    const { payload, updates } = stubPayload({ 5: ['fellow'] })

    await propagateFellowRole(onChange(payload, course(1, []), course(1, [5])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('ignores a save that changes nothing', async () => {
    const { payload, updates } = stubPayload({ 5: ['fellow'] })

    await propagateFellowRole(onChange(payload, course(1, [5]), course(1, [5])))

    expect(updates).toEqual([])
  })

  it('accepts fellows as populated objects, not just ids', async () => {
    const { payload, updates } = stubPayload({ 5: ['member'] })

    await propagateFellowRole(onChange(payload, course(1, [{ id: 5 }]), course(1, [])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member', 'fellow'] } }])
  })
})

describe('revokeDeletedCourseFellows', () => {
  it('revokes fellow when the course is deleted', async () => {
    const { payload, updates } = stubPayload({ 5: ['member', 'fellow'] })

    await revokeDeletedCourseFellows(onDelete(payload, course(1, [5])))

    expect(updates).toEqual([{ id: 5, data: { roles: ['member'] } }])
  })

  it('keeps fellow when another course still lists them', async () => {
    const { payload, updates } = stubPayload({ 5: ['member', 'fellow'] }, [5])

    await revokeDeletedCourseFellows(onDelete(payload, course(1, [5])))

    expect(updates).toEqual([])
  })
})
