/**
 * Picks the admin, fellow and student accounts for the TTFB probe on the
 * throwaway copy cilas_ttfb, gives each one random password, logs each in and
 * writes the three payload-token values to --out. Prints ids only, never an email.
 *
 *   env "${OFF[@]}" "${R2_DEV[@]}" DATABASE_URL=postgres://…/cilas_ttfb \
 *     pnpm exec tsx scripts/ttfb-accounts.ts --out <file>
 *   … scripts/ttfb-accounts.ts --check-off     (runs only the mail, push and storage guard)
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { getPayload } from 'payload'

import { env } from '../src/env'
import { pushConfig } from '../src/lib/push/config'
import config from '../src/payload.config'
import { isLocalUrl } from '../testing/local-env'

// The storage endpoint a production-mode run must carry: src/env.ts:152-157 refuses any other.
const R2_OFF_ENDPOINT = 'https://00000000000000000000000000000000.r2.cloudflarestorage.com'

const { values } = parseArgs({
  options: { out: { type: 'string' }, 'check-off': { type: 'boolean' } },
})

const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

if (!/\/cilas_ttfb(\?|$)/.test(env.DATABASE_URL)) {
  fail('ttfb-accounts runs only on the throwaway copy cilas_ttfb')
}
if (!values['check-off'] && !values.out) fail('need --out <file> or --check-off')

const payload = await getPayload({ config })

// Mail off (M): checked after getPayload and before the first write.
if (payload.email.name !== 'console')
  fail('mail check failed: the email adapter is not the console one')
if (pushConfig() !== null) fail('push check failed: VAPID keys are set')
const storageOff =
  isLocalUrl(env.R2_ENDPOINT) ||
  (env.R2_ENDPOINT === R2_OFF_ENDPOINT && env.R2_ACCESS_KEY_ID === 'off')
if (!storageOff) fail('storage check failed: R2_ENDPOINT is neither local nor the off sentinel')
console.log('mail, push and storage are off')

if (values['check-off']) process.exit(0)

type Pg = { query: (sql: string) => Promise<{ rows: Array<{ id: number; email: string }> }> }
const pg = (payload.db as unknown as { pool: Pg }).pool

const one = async (what: string, sql: string) => {
  const { rows } = await pg.query(sql)
  return rows[0] ?? fail(`no ${what} account found`)
}

const accounts = {
  admin: await one(
    'admin',
    `select u.id, u.email from users u where u.activated_at is not null
       and exists (select 1 from users_roles r where r.parent_id = u.id and r.value in ('admin', 'super_admin'))
     order by u.id limit 1`,
  ),
  fellow: await one(
    'fellow',
    `select u.id, u.email from users u where u.person_id is not null
       and exists (select 1 from users_roles r where r.parent_id = u.id and r.value = 'fellow')
     order by (select count(*) from courses_rels c where c.path = 'fellows' and c.people_id = u.person_id) desc, u.id
     limit 1`,
  ),
  student: await one(
    'student',
    `select u.id, u.email from users u where u.person_id is not null
       and exists (select 1 from users_roles r where r.parent_id = u.id and r.value = 'member')
     order by (select count(*) from enrollments e where e.status = 'accepted' and e.person_id = u.person_id) desc, u.id
     limit 1`,
  ),
}

// A prod dump has fellows who never signed in. Mark the picked account activated on this copy, so
// the login's first-sign-in hook (invitation.ts) has nothing to do and writes no notification.
await pg.query(
  `update users set activated_at = now() where activated_at is null and id in (${Object.values(
    accounts,
  )
    .map((a) => Number(a.id))
    .join(',')})`,
)

const password = randomBytes(24).toString('hex')
const cookies: Record<string, string> = {}
for (const [role, { id, email }] of Object.entries(accounts)) {
  await payload.update({ collection: 'users', id, data: { password }, overrideAccess: true })
  const { token } = await payload.login({ collection: 'users', data: { email, password } })
  if (!token) fail(`${role}: login gave no token`)
  cookies[role] = token as string
  console.log(`${role}: user id ${id}`)
}
writeFileSync(values.out!, JSON.stringify(cookies), { mode: 0o600 })
process.exit(0)
