import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { up } from '../src/migrations/20261028_120000_private_search'

const url = 'postgres://search_test:disposable@localhost:55439/cilas_search_test'
if (process.env.DATABASE_URL !== url)
  throw new Error('Only the dedicated disposable search database is allowed')
if (process.env.R2_ENDPOINT !== 'http://127.0.0.1:19000')
  throw new Error('Only disposable local storage is allowed')
const storage = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  forcePathStyle: true,
  credentials: { accessKeyId: 'local-test', secretAccessKey: 'local-test' },
})
try {
  await storage.send(new CreateBucketCommand({ Bucket: 'local-test' }))
} catch (error) {
  if (
    !(error instanceof Error) ||
    !['BucketAlreadyExists', 'BucketAlreadyOwnedByYou'].includes(error.name)
  )
    throw error
} finally {
  storage.destroy()
}
const resolved = await config
resolved.db = {
  ...postgresAdapter({ pool: { connectionString: url }, push: true }),
  allowIDOnCreate: false,
  name: 'postgres',
}
const payload = await getPayload({ config: resolved })
try {
  await up({ db: payload.db.drizzle } as Parameters<typeof up>[0])
  console.info('Disposable current-schema database and private-search migration initialized')
} finally {
  await payload.destroy()
}
process.exit(0)
