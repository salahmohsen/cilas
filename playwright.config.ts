import { defineConfig, devices } from '@playwright/test'

import 'dotenv/config'
import { register } from 'tsx/esm/api'

// Playwright's own loader refuses JSON imports without an import attribute
// (`with { type: 'json' }`), which the Payload config's modules do not use.
// tsx's loader accepts them. Registering it here, before the specs load,
// covers every way of starting Playwright, not only the package script.
register()

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
    url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
  },
})
