/** Writes the live database to seed/data/live (see snapshot.ts): `pnpm db:snapshot`. */
import { getPayload } from 'payload'
import { exportSnapshot } from './snapshot'

process.loadEnvFile('.env')
const { default: config } = await import('../src/payload.config')
const payload = await getPayload({ config })
await exportSnapshot(payload)
await payload.destroy()
process.exit(0)
