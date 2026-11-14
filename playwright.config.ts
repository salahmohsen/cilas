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

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: 'production.e2e.spec.ts',

  // `CI` is not read through src/env.ts, which would require database and R2
  // credentials just to pick a retry count.
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    reuseExistingServer: true,
    // The real Turnstile widget never gives a token on localhost, so the apply
    // form waited for it and failed after 46 s. Without the keys the forms use
    // only their honeypot (src/components/forms/spam-check.tsx).
    env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: '', TURNSTILE_SECRET_KEY: '' },
    url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  },
})
