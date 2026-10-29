import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, parseEnv } from 'node:util'
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

if (process.env.NODE_ENV === 'production') {
  throw new Error('The local storage clone script cannot run in production')
}
// The source is always R2 and the destination is always this localhost service.
// Production credentials are passed to rclone through its process environment.
const { values } = parseArgs({
  options: {
    'source-env': { type: 'string' },
    'app-dir': { type: 'string', multiple: true },
  },
})
if (!values['source-env']) throw new Error('Pass --source-env /path/to/production/.env')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = parseEnv(await readFile(path.resolve(values['source-env']), 'utf8'))
for (const key of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!source[key]) throw new Error(`Missing source ${key}`)
}
const sourceURL = new URL(source.R2_ENDPOINT)
if (sourceURL.protocol !== 'https:' || !sourceURL.hostname.endsWith('.r2.cloudflarestorage.com')) {
  throw new Error('Source must be a Cloudflare R2 HTTPS endpoint')
}
const endpoint = 'http://127.0.0.1:19002'
const bucket = 'cilas-local'
const credentialsPath = path.join(root, '.env.storage.local')
let credentials
try {
  credentials = parseEnv(await readFile(credentialsPath, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  credentials = {
    RUSTFS_ACCESS_KEY: `cilas-${randomBytes(10).toString('hex')}`,
    RUSTFS_SECRET_KEY: randomBytes(32).toString('hex'),
  }
  await writeFile(
    credentialsPath,
    Object.entries(credentials)
      .map(([k, v]) => `${k}=${v}\n`)
      .join(''),
    { mode: 0o600, flag: 'wx' },
  )
}
if (!credentials.RUSTFS_ACCESS_KEY || !credentials.RUSTFS_SECRET_KEY) {
  throw new Error('Incomplete .env.storage.local; refusing to change storage credentials')
}
await chmod(credentialsPath, 0o600)

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Docker command failed (${code})`)),
    )
  })
}
await run([
  'compose',
  '-p',
  'cilas-storage',
  '--env-file',
  credentialsPath,
  '-f',
  path.join(root, 'docker-compose.storage.yml'),
  'up',
  '-d',
  '--wait',
])

const storage = new S3Client({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: credentials.RUSTFS_ACCESS_KEY,
    secretAccessKey: credentials.RUSTFS_SECRET_KEY,
  },
})
try {
  await storage.send(new HeadBucketCommand({ Bucket: bucket }))
} catch (error) {
  if (error.$metadata?.httpStatusCode !== 404) throw error
  await storage.send(new CreateBucketCommand({ Bucket: bucket }))
}
await storage.send(
  new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicMediaOnly',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/media/*`],
        },
      ],
    }),
  }),
)

const temp = await mkdtemp(path.join(tmpdir(), 'cilas-rclone-'))
const sourceStorage = new S3Client({
  endpoint: source.R2_ENDPOINT,
  region: 'auto',
  forcePathStyle: true,
  credentials: {
    accessKeyId: source.R2_ACCESS_KEY_ID,
    secretAccessKey: source.R2_SECRET_ACCESS_KEY,
  },
})
async function inventory(client, name) {
  const objects = []
  let continuation
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: name, ContinuationToken: continuation }),
    )
    objects.push(...(page.Contents ?? []))
    continuation = page.NextContinuationToken
  } while (continuation)
  return objects.sort((a, b) => a.Key.localeCompare(b.Key))
}
const transferEnv = {
  ...process.env,
  RCLONE_CONFIG_SOURCE_TYPE: 's3',
  RCLONE_CONFIG_SOURCE_PROVIDER: 'Cloudflare',
  RCLONE_CONFIG_SOURCE_ACCESS_KEY_ID: source.R2_ACCESS_KEY_ID,
  RCLONE_CONFIG_SOURCE_SECRET_ACCESS_KEY: source.R2_SECRET_ACCESS_KEY,
  RCLONE_CONFIG_SOURCE_ENDPOINT: source.R2_ENDPOINT,
  RCLONE_CONFIG_SOURCE_REGION: 'auto',
  RCLONE_CONFIG_SOURCE_NO_CHECK_BUCKET: 'true',
  RCLONE_CONFIG_LOCAL_TYPE: 's3',
  RCLONE_CONFIG_LOCAL_PROVIDER: 'Other',
  RCLONE_CONFIG_LOCAL_ACCESS_KEY_ID: credentials.RUSTFS_ACCESS_KEY,
  RCLONE_CONFIG_LOCAL_SECRET_ACCESS_KEY: credentials.RUSTFS_SECRET_KEY,
  RCLONE_CONFIG_LOCAL_ENDPOINT: 'http://host.docker.internal:19002',
  RCLONE_CONFIG_LOCAL_REGION: 'us-east-1',
  RCLONE_CONFIG_LOCAL_FORCE_PATH_STYLE: 'true',
}
const dockerArgs = ['run', '--rm', '-v', `${temp}:/config/rclone`]
for (const key of Object.keys(transferEnv).filter((k) => k.startsWith('RCLONE_CONFIG_'))) {
  dockerArgs.push('--env', key)
}
dockerArgs.push(
  'rclone/rclone:1.73.2@sha256:8a17d9b5cd5ce71bbb42e49e92ee83575d7fb03f6233d949d328e9d029b9376d',
)
try {
  const before = await inventory(sourceStorage, source.R2_BUCKET)
  await run([...dockerArgs, 'size', `source:${source.R2_BUCKET}`], transferEnv)
  // copy never deletes objects from either side; source operations are reads.
  await run(
    [
      ...dockerArgs,
      'copy',
      `source:${source.R2_BUCKET}`,
      `local:${bucket}`,
      '--metadata',
      '--stats',
      '30s',
      '--stats-one-line',
    ],
    transferEnv,
  )
  // Download both sides to verify bytes, including multipart objects without MD5s.
  await run(
    [
      ...dockerArgs,
      'check',
      `source:${source.R2_BUCKET}`,
      `local:${bucket}`,
      '--download',
      '--one-way',
      '--stats',
      '30s',
      '--stats-one-line',
    ],
    transferEnv,
  )

  // rclone treats empty S3 directory markers as directories, not files.
  for (const object of before.filter((o) => o.Key.endsWith('/') && o.Size === 0)) {
    const marker = await sourceStorage.send(
      new GetObjectCommand({ Bucket: source.R2_BUCKET, Key: object.Key }),
    )
    const body = await marker.Body.transformToByteArray()
    if (body.length !== 0) throw new Error('Directory marker changed during copy')
    await storage.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: object.Key,
        Body: body,
        ContentType: marker.ContentType,
        CacheControl: marker.CacheControl,
        Metadata: marker.Metadata,
      }),
    )
  }
  const after = await inventory(sourceStorage, source.R2_BUCKET)
  const revision = (items) => JSON.stringify(items.map((o) => [o.Key, o.Size, o.ETag]))
  if (revision(before) !== revision(after))
    throw new Error('R2 changed during copy; rerun before switching the app')
  const local = await inventory(storage, bucket)
  const byKey = new Map(local.map((o) => [o.Key, o]))
  if (after.some((o) => byKey.get(o.Key)?.Size !== o.Size))
    throw new Error('Local object inventory differs from R2')
  console.log(
    JSON.stringify({
      verified: true,
      sourceObjects: after.length,
      localObjects: local.length,
      bytes: after.reduce((sum, o) => sum + o.Size, 0),
      endpoint,
    }),
  )

  // Switch the app only once the copy and byte comparison have succeeded.
  const overrides = {
    DATABASE_URL: 'postgres://cilas:dev@localhost:5433/cilas_dev',
    R2_BUCKET: bucket,
    R2_ENDPOINT: endpoint,
    R2_PUBLIC_URL: `${endpoint}/${bucket}`,
    R2_ACCESS_KEY_ID: credentials.RUSTFS_ACCESS_KEY,
    R2_SECRET_ACCESS_KEY: credentials.RUSTFS_SECRET_KEY,
    R2_REGION: 'us-east-1',
  }
  for (const appDir of new Set([root, ...(values['app-dir'] ?? []).map((p) => path.resolve(p))])) {
    const envPath = path.join(appDir, '.env.development.local')
    let text = ''
    try {
      text = await readFile(envPath, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    const appOverrides = { ...overrides }
    if (!parseEnv(text).PAYLOAD_SECRET && source.PAYLOAD_SECRET)
      appOverrides.PAYLOAD_SECRET = source.PAYLOAD_SECRET
    for (const [key, value] of Object.entries(appOverrides)) {
      const line = `${key}=${JSON.stringify(value)}`
      const pattern = new RegExp(`^${key}=.*$`, 'gm')
      text = pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`
    }
    await writeFile(envPath, text, { mode: 0o600 })
    await chmod(envPath, 0o600)
    console.log(`Connected ${envPath} to local storage.`)
  }
} finally {
  sourceStorage.destroy()
  storage.destroy()
  await rm(temp, { recursive: true, force: true })
}
