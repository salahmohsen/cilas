// Read-only: bytes and object counts per key prefix in the R2 bucket, next to
// what the database says for each upload collection. Prints totals only.
//   node scripts/measure-r2.mjs --env /path/to/.env
import { readFile } from 'node:fs/promises'
import { parseArgs, parseEnv } from 'node:util'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'

const { values } = parseArgs({ options: { env: { type: 'string' } } })
if (!values.env) throw new Error('Pass --env /path/to/.env')
const env = parseEnv(await readFile(values.env, 'utf8'))
for (const k of ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'])
  if (!env[k]) throw new Error(`Missing ${k}`)

const s3 = new S3Client({
  endpoint: env.R2_ENDPOINT,
  region: env.R2_REGION || 'auto',
  forcePathStyle: true,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})
const bucket = {}
let token
let requests = 0
do {
  const page = await s3.send(
    new ListObjectsV2Command({ Bucket: env.R2_BUCKET, ContinuationToken: token }),
  )
  requests++
  for (const { Key = '', Size = 0 } of page.Contents ?? []) {
    const prefix = Key.includes('/') ? Key.split('/')[0] : '(root)'
    const row = (bucket[prefix] ??= { objects: 0, bytes: 0 })
    row.objects++
    row.bytes += Size
  }
  token = page.NextContinuationToken
} while (token)
const mb = (n) => (n / 1048576).toFixed(1)
console.log(`bucket ${env.R2_BUCKET}, ${requests} list request(s)`)
let total = 0
for (const [p, r] of Object.entries(bucket).sort((a, b) => b[1].bytes - a[1].bytes)) {
  total += r.bytes
  console.log(
    `  ${p.padEnd(16)} ${String(r.objects).padStart(7)} objects ${mb(r.bytes).padStart(10)} MB`,
  )
}
console.log(`  TOTAL ${mb(total)} MB`)

if (env.DATABASE_URL) {
  const db = new pg.Client({ connectionString: env.DATABASE_URL })
  await db.connect()
  const cols = async (t) =>
    (
      await db.query(
        `select column_name c from information_schema.columns where table_name=$1 and column_name like '%filesize'`,
        [t],
      )
    ).rows.map((r) => r.c)
  console.log('database:')
  for (const t of ['media', 'space_files', 'submission_files']) {
    const c = await cols(t)
    if (!c.length) {
      console.log(`  ${t}: no filesize columns`)
      continue
    }
    const parts = c.map(
      (x) => `coalesce(sum("${x}"),0)::bigint as "${x}", count("${x}")::int as "n_${x}"`,
    )
    const [row] = (await db.query(`select count(*)::int as rows, ${parts.join(', ')} from "${t}"`))
      .rows
    const sum = c.reduce((a, x) => a + Number(row[x]), 0)
    const files = c.reduce((a, x) => a + row[`n_${x}`], 0)
    console.log(
      `  ${t}: ${row.rows} rows, ${files} files, ${mb(sum)} MB (main ${mb(Number(row.filesize))} MB)`,
    )
    for (const x of c)
      if (x !== 'filesize') console.log(`    ${x} ${mb(Number(row[x]))} MB, ${row['n_' + x]} files`)
  }
  await db.end()
}
