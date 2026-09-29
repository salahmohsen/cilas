import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { createSeedContext } from './seed.type'
import { resetContent } from './seed.utils'
import { seedUsers, linkFellows } from './collections/users.seed'
import { seedFieldsOfStudy } from './collections/fields-of-study.seed'
import { seedCycles } from './collections/cycles.seed'
import { seedProgrammes } from './collections/programmes.seed'
import { seedCourses } from './collections/courses.seed'
import { seedGovernance } from './collections/governance.seed'
import { seedArticles } from './collections/articles.seed'
import { seedPress } from './collections/press.seed'
import { seedEvents } from './collections/events.seed'
import { seedSpaces } from './collections/spaces.seed'
import { seedArticleCollections } from './collections/article-collections.seed'
import { seedSiteSettings } from './collections/site-settings.seed'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')

const payload: Payload = await getPayload({ config })
const ctx = createSeedContext()

// Content is wiped; user accounts are matched by email and survive.
await resetContent(payload)

// Order matters: every seeder reads ids resolved by the ones above it.
await seedUsers(payload, ctx)
await seedFieldsOfStudy(payload, ctx)
await seedCycles(payload, ctx)
await seedProgrammes(payload, ctx)
await seedCourses(payload, ctx)
await linkFellows(payload, ctx) // needs fields-of-study + courses to exist
await seedGovernance(payload, ctx)
await seedArticles(payload, ctx)
await seedPress(payload)
await seedEvents(payload)
await seedSpaces(payload)
await seedArticleCollections(payload, ctx)
await seedSiteSettings(payload)

await payload.destroy()
console.log('\nSEED COMPLETE')
process.exit(0)
