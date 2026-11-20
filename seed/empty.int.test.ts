import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scratchPayload } from '../testing/scratch-database.test-utils'

type Empty = typeof import('./empty')
type Role = keyof Empty['EMPTY_ACCOUNTS']

const ROLES: Role[] = ['admin', 'fellow', 'student']

describe('seedEmpty', () => {
  let payload: Payload
  let destroy: () => Promise<void>
  let empty: Empty
  let ids: Record<Role, number>

  beforeAll(async () => {
    ;({ payload, destroy } = await scratchPayload())
    empty = await import('./empty')
    ids = await empty.seedEmpty(payload)
  }, 600_000)
  afterAll(async () => {
    await destroy?.()
  })

  it.each(ROLES)('the %s signs in', async (role) => {
    const { email, password } = empty.EMPTY_ACCOUNTS[role]
    const result = await payload.login({ collection: 'users', data: { email, password } })
    expect(result.user?.id).toBe(ids[role])
    expect(result.user?.roles).toEqual(empty.EMPTY_ACCOUNTS[role].roles)
  })

  it('the fellow has a person and teaches no course', async () => {
    const fellow = await payload.findByID({ collection: 'users', id: ids.fellow, depth: 1 })
    expect(fellow.person).toMatchObject({ name: 'Empty Fellow', slug: 'empty-fellow' })
    const person = typeof fellow.person === 'object' && fellow.person ? fellow.person.id : null
    const { totalDocs } = await payload.find({
      collection: 'courses',
      where: { fellows: { contains: person } },
      overrideAccess: true,
      limit: 1,
    })
    expect(totalDocs).toBe(0)
  })

  it('the admin has no person', async () => {
    const admin = await payload.findByID({ collection: 'users', id: ids.admin, depth: 0 })
    expect(admin.person ?? null).toBeNull()
  })

  it('the world holds no space, spaces on', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
    const { totalDocs } = await payload.count({ collection: 'spaces', overrideAccess: true })
    expect(totalDocs).toBe(0)
  })

  it('a second run changes nothing', async () => {
    expect(await empty.seedEmpty(payload)).toEqual(ids)
    const { totalDocs } = await payload.count({ collection: 'users', overrideAccess: true })
    expect(totalDocs).toBe(3)
  })
})
