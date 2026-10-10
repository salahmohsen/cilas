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
import { seedSpaces } from './collections/spaces.seed'
import { seedPartners } from './collections/partners.seed'
import { seedArticleCollections } from './collections/article-collections.seed'
import { seedSiteSettings } from './collections/site-settings.seed'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })
const ctx = createSeedContext()

// First: the superadmin account. Must run before resetContent, which only
// deletes content collections — user accounts are matched by email and
// survive, so a fresh migration never leaves the admin panel unreachable.
await createSuperAdmin(payload)

// Content is wiped; user accounts are matched by email and survive.
await resetContent(payload)

// Order matters: every seeder reads ids resolved by the ones above it.
await seedUsers(payload, ctx)
await seedSpaces(payload, ctx)
await seedPartners(payload, ctx)
await seedCycles(payload, ctx)
await seedProgrammes(payload, ctx)
await seedCourses(payload, ctx)
await linkFellows(payload, ctx) // validates that course fellows were seeded
await seedGovernance(payload, ctx)
await seedArticles(payload, ctx)
await seedPress(payload)
await seedEvents(payload, ctx)
await seedArticleCollections(payload, ctx)
await seedSiteSettings(payload)

await payload.destroy()
console.log('\nSEED COMPLETE')
process.exit(0)
