import { defineConfig, devices } from '@playwright/test'

import { config as loadEnv } from 'dotenv'
import { register } from 'tsx/esm/api'

import { EMPTY_DATABASE } from './seed/empty-url'
import { isLocalUrl, requireLocalStorage } from './testing/local-env'

register()

loadEnv({ path: ['.env.development.local', '.env.local', '.env'] })
requireLocalStorage(process.env)

const { hostname: databaseHost, pathname: databasePath } = new URL(
  process.env.DATABASE_URL ?? 'postgres://unset',
)
const onEmptySeed = databasePath === `/${EMPTY_DATABASE}`
const EMPTY_SPECS = '**/*.empty.e2e.test.ts'
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
  throw new Error(`The e2e specs write to the database, and "${databaseHost}" is not a local host.`)
}

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://localhost:3000'

if (!process.env.CI) {
  if (new URL(baseURL).port === '3000')
    throw new Error(
      'Refusing to run e2e on port 3000 (production) outside CI. Set PLAYWRIGHT_BASE_URL=http://localhost:3100.',
    )
  if (!isLocalUrl(baseURL))
    throw new Error(
      `Refusing to run e2e against ${new URL(baseURL).hostname}: PLAYWRIGHT_BASE_URL must be a local URL.`,
    )
}

export default defineConfig({
  testDir: './e2e',
  testIgnore: onEmptySeed ? 'production.e2e.test.ts' : ['production.e2e.test.ts', EMPTY_SPECS],
  ...(onEmptySeed && { testMatch: EMPTY_SPECS }),

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
  webServer: process.env.CI
    ? {
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
      }
    : undefined,
})
