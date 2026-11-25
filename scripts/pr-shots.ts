// Screenshots of a running local app for a pull request, taken without an
// agent looking at the pages (each look costs tokens).
//
//   pnpm pr:shots <spec.json> [pr-number]
//
// The app must already run against the local database (`pnpm dev`). The
// script signs in as a throwaway admin it makes and deletes, and saves one PNG
// per shot next to the spec. Given a PR number, it posts them as one PR comment
// that names the commit they show (`gh issue comment --attach`, gh 2.103 or
// later), so each UI change adds a comment and the PR keeps the history. The spec:
//
//   {
//     "base": "http://localhost:3000",          // optional
//     "shots": [{
//       "name": "posts-list",                     // the file name
//       "alt": "Posts list with space names",     // the image's alt text
//       "path": "/admin/collections/space-posts",
//       "click": ["button[aria-label='Delete']"], // optional, in order
//       "wait": "text=This permanently deletes",  // optional selector to wait for
//       "element": ".confirmation-modal"          // optional: shoot this element only
//     }]
//   }
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import config from '@payload-config'
import { getPayload } from 'payload'
import { chromium } from 'playwright'

type Shot = {
  name: string
  alt: string
  path: string
  click?: string[]
  wait?: string
  element?: string
}

const [specArg, prArg] = process.argv.slice(2).map(String)
if (!specArg) {
  console.error('Usage: pnpm pr:shots <spec.json> [pr-number]')
  process.exit(1)
}
const specPath = resolve(specArg)
const spec = JSON.parse(readFileSync(specPath, 'utf8')) as { base?: string; shots: Shot[] }
const base = spec.base ?? 'http://localhost:3000'
const outDir = dirname(specPath)

const payload = await getPayload({ config })
const email = `pr-shots-${randomBytes(4).toString('hex')}@cilas.test`
const password = randomBytes(18).toString('hex')
const admin = await payload.create({
  collection: 'users',
  data: { email, password, roles: ['admin'] } as never,
  overrideAccess: true,
})

const files: string[] = []
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
  const browser = await chromium.launch()
  try {
    // Wide enough that the admin sidebar docks instead of covering the page, and
    // no motion, so no shot catches a transition halfway.
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })
    const { hostname } = new URL(base)
    await context.addCookies([
      { name: 'payload-token', value: token, domain: hostname, path: '/', httpOnly: true },
    ])
    const page = await context.newPage()
    for (const shot of spec.shots) {
      // Not 'networkidle': the dev server's reload socket never goes quiet.
      await page.goto(new URL(shot.path, base).href, { waitUntil: 'load', timeout: 180_000 })
      // The dev server's Next.js badge is not part of the app.
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
      for (const selector of shot.click ?? []) await page.locator(selector).first().click()
      if (shot.wait) await page.locator(shot.wait).first().waitFor({ timeout: 60_000 })
      // Admin cells render "Loading..." (or "Loading…") until their data arrives.
      await page.waitForFunction(() => !/Loading(\.\.\.|…)/.test(document.body.innerText), null, {
        timeout: 60_000,
      })
      const file = join(outDir, `${shot.name}.png`)
      const target = shot.element ? page.locator(shot.element).first() : page
      await target.screenshot({ path: file })
      files.push(`${file}#${shot.alt}`)
    }
  } finally {
    await browser.close()
  }
} finally {
  await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true })
}

if (prArg) {
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  execFileSync(
    'gh',
    [
      'issue',
      'comment',
      prArg,
      '--body',
      `Screenshots at ${sha}`,
      ...files.flatMap((f) => ['--attach', f]),
    ],
    { stdio: 'inherit' },
  )
} else for (const file of files) console.log(file.split('#')[0])
process.exit(0)
