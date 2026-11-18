import { defineConfig, devices } from '@playwright/test'

import { config as loadEnv } from 'dotenv'
import { register } from 'tsx/esm/api'

register()

loadEnv({ path: ['.env.development.local', '.env.local', '.env'] })

const { hostname: databaseHost } = new URL(process.env.DATABASE_URL ?? 'postgres://unset')
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
  throw new Error(`The e2e specs write to the database, and "${databaseHost}" is not a local host.`)
}

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'production.e2e.test.ts',

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  reporter: 'html',

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
    command: 'cross-env CI=1 pnpm build && pnpm start',
    reuseExistingServer: true,
    timeout: 600_000,
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
