import { getPayload } from 'payload'
import type { User } from '../../src/payload-types.js'
import config from '../../src/payload.config.js'

export const testUser = {
  email: `e2e-${crypto.randomUUID()}@cilas.test`,
  password: 'test',
  // `roles` is required. The admin tests create courses, and several
  // collections are hidden from non-admins, so this user needs admin rights.
  roles: ['super_admin'] as User['roles'],
}

export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.create({
    collection: 'users',
    data: testUser,
  })
}

export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
