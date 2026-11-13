/**
 * Makes or removes a throwaway admin for an e2e run. Playwright cannot load the
 * Payload config (its JSON imports need an import attribute), so specs run this
 * with tsx:
 *
 *   pnpm tsx tests/helpers/admin-user.ts create|delete <email> [password]
 */
import { getPayload } from 'payload'

import config from '../../src/payload.config'

const [action, email, password = 'test'] = process.argv.slice(2)
if (!email || (action !== 'create' && action !== 'delete')) {
  throw new Error('Usage: admin-user.ts create|delete <email> [password]')
}
const payload = await getPayload({ config })
if (action === 'create') {
  await payload.create({
    collection: 'users',
    data: { email, password, roles: ['super_admin'] },
    overrideAccess: true,
  })
} else {
  await payload.delete({
    collection: 'users',
    where: { email: { equals: email } },
    overrideAccess: true,
  })
}
process.exit(0)
