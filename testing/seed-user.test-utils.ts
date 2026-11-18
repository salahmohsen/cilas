import { getPayload, type Payload } from 'payload'
import type { User } from '../src/payload-types.js'
import config from '../src/payload.config.js'

export const testUser = {
  email: `e2e-${crypto.randomUUID()}@cilas.test`,
  password: 'test',
  roles: ['super_admin'] as User['roles'],
}

export async function seedTestUser(payload?: Payload) {
  payload ??= await getPayload({ config })

  await payload.create({
    collection: 'users',
    data: testUser,
  })
}

export async function cleanupTestUser(payload?: Payload) {
  payload ??= await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: {
      email: {
        equals: testUser.email,
      },
    },
  })
}
