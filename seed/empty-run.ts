import { Pool } from 'pg'

import { requireLocalStorage } from '../testing/local-env'
import { EMPTY_DATABASE, emptyDatabaseUrl } from './empty-url'
import { requireLocalSeedDatabase } from './local-database'

for (const key of ['RESEND_API_KEY', 'TYPESENSE_API_KEY']) process.env[key] = ''
for (const file of ['.env.development.local', '.env.local']) {
  try {
    process.loadEnvFile(file)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

requireLocalStorage(process.env)
const url = emptyDatabaseUrl(requireLocalSeedDatabase(process.env.DATABASE_URL))

const admin = new Pool({ connectionString: new URL('/postgres', url).toString() })
try {
  await admin.query(`DROP DATABASE IF EXISTS ${EMPTY_DATABASE} WITH (FORCE)`)
  await admin.query(`CREATE DATABASE ${EMPTY_DATABASE}`)
} finally {
  await admin.end()
}
process.env.DATABASE_URL = url

const { default: config } = await import('../src/payload.config')
const { env } = await import('../src/env')
if (new URL(env.DATABASE_URL).pathname !== `/${EMPTY_DATABASE}`) {
  throw new Error(`Refusing to seed: the config did not pick up ${EMPTY_DATABASE}.`)
}

const { getPayload } = await import('payload')
const { migrateAll } = await import('./migrate-all')
const { EMPTY_ACCOUNTS, seedEmpty } = await import('./empty')

const payload = await getPayload({ config })
await migrateAll(payload)
await seedEmpty(payload)
await payload.destroy()

console.log(`\nDATABASE_URL=${url}`)
for (const { email, password } of Object.values(EMPTY_ACCOUNTS))
  console.log(`${email}  ${password}`)
process.exit(0)
