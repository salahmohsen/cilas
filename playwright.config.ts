import { defineConfig, devices } from '@playwright/test'

import { config as loadEnv } from 'dotenv'
import { register } from 'tsx/esm/api'

// Playwright's own loader refuses JSON imports without an import attribute
// (`with { type: 'json' }`), which the Payload config's modules do not use.
// tsx's loader accepts them. Registering it here, before the specs load,
// covers every way of starting Playwright, not only the package script.
register()

// The specs open the database themselves (a test user, courses, sessions), so
// they must read the files the server reads, in Next's order (first file
// wins). `dotenv/config` read only `.env`, which names the production
// database; `.env.development.local` names the local one.
loadEnv({ path: ['.env.development.local', '.env.local', '.env'] })

const { hostname: databaseHost } = new URL(process.env.DATABASE_URL ?? 'postgres://unset')
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
  throw new Error(`The e2e specs write to the database, and "${databaseHost}" is not a local host.`)
}

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: 'production.e2e.spec.ts',

  // `CI` is not read through src/env.ts, which would require database and R2
  // credentials just to pick a retry count.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  // The default 5 s is shorter than a save through the server under five parallel
  // workers (a dialog that waits for it timed out once at 5 s, then opened in under 10 s).
  expect: { timeout: 30_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    // The production build, not `next dev`: the dev server compiles each route
    // on its first request, and a compile stalls every other request for tens
    // of seconds, so the specs timed out in a different place on each run.
    // `CI` only limits the build's workers (next.config.ts). A server that is
    // already running is reused, such as `pnpm dev` for a quick run of one spec.
    command: 'cross-env CI=1 pnpm build && pnpm start',
    reuseExistingServer: true,
    timeout: 600_000,
    // The real Turnstile widget never gives a token on localhost. Without the
    // keys the forms use only their honeypot (src/components/forms/spam-check.tsx).
    // The site key is part of the build, so the build needs this too.
    //
    // A production server refuses any storage but Cloudflare R2 (src/env.ts),
    // so the local storage of `.env.development.local` cannot be used. The
    // specs upload nothing; an endpoint that does not exist makes an upload
    // fail at once, where the real keys of `.env` would reach real storage.
    env: {
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
      TURNSTILE_SECRET_KEY: '',
      R2_ENDPOINT: 'https://e2e.invalid.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'e2e',
      R2_SECRET_ACCESS_KEY: 'e2e',
    },
    url: baseURL,
  },
})
