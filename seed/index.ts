import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { createSeedContext } from './seed.type'
import { resetContent } from './seed.utils'
import { createSuperAdmin } from './super-admin'
import { seedUsers, linkFellows } from './collections/users.seed'
import { seedCycles } from './collections/cycles.seed'
import { seedProgrammes } from './collections/programmes.seed'
import { seedCourses } from './collections/courses.seed'
import { seedGovernance } from './collections/governance.seed'
import { seedArticles } from './collections/articles.seed'
import { seedPress } from './collections/press.seed'
import { seedEvents } from './collections/events.seed'
import { seedPlaces } from './collections/places.seed'
import { seedSiteSettings } from './collections/site-settings.seed'
import { hasSnapshot, restoreSnapshot } from './snapshot'

process.loadEnvFile('.env')

// The seed wipes and re-creates content, so it only ever runs against the
// local docker Postgres of this branch.
if (!process.env.DATABASE_URL?.includes('@localhost:5433/')) {
  throw new Error(
    'Refusing to seed: DATABASE_URL must point at localhost:5433/cilas_dev. Export DATABASE_URL=postgres://cilas:dev@localhost:5433/cilas_dev.',
  )
}

const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })
const ctx = createSeedContext()

// The live site, when a snapshot was taken (`pnpm db:snapshot`): restored as
// it was, instead of the dev seed below.
if (hasSnapshot() && !process.argv.includes('--dev')) {
  await restoreSnapshot(payload)
  await createSuperAdmin(payload)
  await payload.destroy()
  console.log('\nSEED COMPLETE (snapshot)')
  process.exit(0)
}

// First: the superadmin account. Must run before resetContent, which only
// deletes content collections — user accounts are matched by email and
// survive, so a fresh migration never leaves the admin panel unreachable.
await createSuperAdmin(payload)

await resetContent(payload)

// Order matters: every seeder reads ids resolved by the ones above it.
await seedUsers(payload, ctx)
await seedPlaces(payload, ctx)
await seedCycles(payload, ctx)
await seedProgrammes(payload, ctx)
await seedCourses(payload, ctx)
await linkFellows(payload, ctx) // validates that course fellows were seeded
await seedGovernance(payload, ctx)
await seedArticles(payload, ctx)
await seedPress(payload, ctx)
await seedEvents(payload, ctx)
await seedSiteSettings(payload)

await payload.destroy()
console.log('\nSEED COMPLETE')
process.exit(0)
