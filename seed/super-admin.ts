import type { Payload } from 'payload'

/**
 * The one account that always exists. Seeded before everything else so the
 * admin panel is never locked out after a fresh migration.
 *
 * Matched by email, so re-running is idempotent: an existing account is
 * returned untouched and its password is never reset. If the account is missing
 * it is created with the password below.
 */
export const SUPER_ADMIN_EMAIL = 'salahmmohsen@gmail.com'
export const SUPER_ADMIN_PASSWORD = 'salahmmohsen@gmail.com'

export const createSuperAdmin = async (payload: Payload): Promise<void> => {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: SUPER_ADMIN_EMAIL } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.totalDocs > 0) {
    console.log('super_admin: already present, leaving untouched')
    return
  }

  await payload.create({
    collection: 'users',
    data: {
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      roles: ['super_admin'],
    },
    overrideAccess: true,
  })

  console.log('super_admin: created')
}
