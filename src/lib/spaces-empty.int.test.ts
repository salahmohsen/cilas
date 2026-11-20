import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scratchPayload } from '../../testing/scratch-database.test-utils'

type Role = 'admin' | 'fellow' | 'student'

const ROLES: Role[] = ['admin', 'fellow', 'student']

describe('mySpaces for a reader with no readable space', () => {
  let payload: Payload
  let destroy: () => Promise<void>
  let ids: Record<Role, number>

  beforeAll(async () => {
    ;({ payload, destroy } = await scratchPayload())
    const { seedEmpty } = await import('../../seed/empty')
    ids = await seedEmpty(payload)
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
  }, 600_000)
  afterAll(async () => {
    await destroy?.()
  })

  it.each(ROLES)('returns the empty result for the %s', async (role) => {
    const { mySpaces } = await import('./spaces-data')
    const user = await payload.findByID({ collection: 'users', id: ids[role], depth: 0 })
    expect(await mySpaces(payload, user, 'en')).toEqual({
      communities: [],
      cohorts: [],
      courses: [],
    })
  })
})
