import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { syncFellowRoleOnLink } from '@/collections/Users'
import type { User } from '@/payload-types'

type Role = User['roles'][number]
type Args = Parameters<typeof syncFellowRoleOnLink>[0]
type FindArgs = { where: { and: Array<{ fellows: { contains: number } }> } }

/** `teaching` = person ids listed on at least one course. */
const call = async (
  data: Partial<User>,
  originalDoc: Partial<User> | undefined,
  teaching: number[],
): Promise<Partial<User>> => {
  const payload = {
    find: vi.fn(async ({ where }: FindArgs) => ({
      docs: [],
      totalDocs: teaching.includes(where.and[0].fellows.contains) ? 1 : 0,
    })),
  } as unknown as Payload
  return syncFellowRoleOnLink({ data, originalDoc, req: { payload } } as unknown as Args)
}

const roles = (r: Role[]) => r

describe('syncFellowRoleOnLink', () => {
  it('grants fellow when linked to a person who teaches', async () => {
    const out = await call({ person: 50 }, { roles: roles(['member']), person: null }, [50])
    expect(out.roles).toEqual(['member', 'fellow'])
  })

  it('leaves roles alone when the person does not teach', async () => {
    const out = await call({ person: 50 }, { roles: roles(['member']), person: null }, [])
    expect(out.roles).toBeUndefined()
  })

  it('revokes fellow when unlinked', async () => {
    const out = await call(
      { person: null },
      { roles: roles(['member', 'fellow']), person: 50 },
      [50],
    )
    expect(out.roles).toEqual(['member'])
  })

  it('ignores saves that do not touch person', async () => {
    const out = await call({ roles: roles(['admin']) }, { roles: roles(['member']), person: 50 }, [
      50,
    ])
    expect(out).toEqual({ roles: ['admin'] })
  })

  it('uses roles from the same save when present', async () => {
    const out = await call({ person: 50, roles: roles(['admin']) }, undefined, [50])
    expect(out.roles).toEqual(['admin', 'fellow'])
  })
})
