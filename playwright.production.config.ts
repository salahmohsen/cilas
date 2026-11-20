import { defineConfig, devices } from '@playwright/test'

if (!process.env.CI)
  throw new Error('playwright.production.config.ts runs in CI only: port 3000 is production here.')

export default defineConfig({
  testDir: './e2e',
  testMatch: 'production.e2e.test.ts',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/start-smoke.mjs',
    url: 'http://localhost:3000/en',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
