// Screenshots of the running local app for a pull request, signed in as an
// admin. shot-scraper takes them (https://shot-scraper.datasette.io); this
// script adds only what is Payload's own: the sign-in.
//
//   pnpm pr:shots <shots.yml> [base-url]
//
// `pnpm dev` must run against the local database; base-url defaults to
// http://localhost:3000. The script makes a throwaway admin, writes
// shot-scraper's sign-in file into a temporary folder, runs
// `shot-scraper multi <shots.yml>` from the YAML file's folder, and always
// deletes the admin and the file. Neither the password nor the token is
// written anywhere else. Post the images with
// `gh issue comment <pr> --attach '<file>#<alt>'`.
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'

const [specArg, baseArg] = process.argv.slice(2).map(String)
if (!specArg) {
  console.error('Usage: pnpm pr:shots <shots.yml> [base-url]')
  process.exit(1)
}
const spec = resolve(specArg)
const base = new URL(baseArg ?? 'http://localhost:3000')

const payload = await getPayload({ config })
// A run that was killed could not delete its admin: the next run does, once
// the admin is an hour old (a younger one may belong to a run still going).
await payload.delete({
  collection: 'users',
  where: {
    and: [
      { email: { like: 'pr-shots-' } },
      { email: { like: '@cilas.test' } },
      { createdAt: { less_than: new Date(Date.now() - 3_600_000).toISOString() } },
    ],
  },
  overrideAccess: true,
})
const email = `pr-shots-${randomBytes(4).toString('hex')}@cilas.test`
const password = randomBytes(18).toString('hex')
const admin = await payload.create({
  collection: 'users',
  data: { email, password, roles: ['admin'] } as never,
  overrideAccess: true,
})
const authDir = mkdtempSync(join(tmpdir(), 'pr-shots-'))
const cleanUp = async () => {
  rmSync(authDir, { recursive: true, force: true })
  await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true })
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => void cleanUp().finally(() => process.exit(1)))

let status = 1
try {
  const { token } = await payload.login({ collection: 'users', data: { email, password } })
  if (!token) throw new Error('The throwaway admin could not sign in.')
  // A new account starts with the admin sidebar open, and the theme draws it over the page.
  const nav = await fetch(new URL('/api/payload-preferences/nav', base), {
    method: 'POST',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: { open: false } }),
  })
  if (!nav.ok) throw new Error(`Could not close the admin sidebar: ${nav.status}`)

  // A Playwright storage state, the format of `shot-scraper auth`.
  const auth = join(authDir, 'auth.json')
  const cookie = { name: 'payload-token', value: token, domain: base.hostname, path: '/' }
  const expires = Math.floor(Date.now() / 1000) + 3600
  writeFileSync(
    auth,
    JSON.stringify({
      cookies: [{ ...cookie, expires, httpOnly: true, secure: false, sameSite: 'Lax' }],
      origins: [],
    }),
    { mode: 0o600 },
  )
  status =
    spawnSync(
      'shot-scraper',
      ['multi', spec, '--auth', auth, '--reduced-motion', '--timeout', '60000'],
      {
        cwd: dirname(spec),
        stdio: 'inherit',
      },
    ).status ?? 1
} finally {
  await cleanUp()
}
process.exit(status)
