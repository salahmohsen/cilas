import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { playwright } from '@vitest/browser-playwright'

const domTs = [
  'scripts/calendar-month-list.unit.test.ts',
  'src/components/arc/rich-text-editor/mention-trigger.unit.test.ts',
  'src/components/calendar/ui/week-spans.unit.test.ts',
  'src/components/profile-bio.unit.test.ts',
  'src/env.unit.test.ts',
  'src/lib/analytics/analytics-sdk.unit.test.ts',
  'src/lib/leave-guard.unit.test.ts',
  'src/lib/scroll-to-section.unit.test.ts',
]
const nodeTsx = ['src/emails/emails.unit.test.tsx']
const ignored = ['**/node_modules/**', '.next/**']
const browserTests = ['**/*.browser.test.{ts,tsx}']
const browserEnv = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => name.startsWith('NEXT_PUBLIC_')),
)

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    hookTimeout: 120_000,
    testTimeout: 120_000,
    unstubGlobals: true,
    unstubEnvs: true,
    execArgv: ['--no-experimental-webstorage'],
    server: {
      deps: {
        inline: ['payload-theme', 'payload-oauth2', 'next-intl'],
      },
    },
    projects: [
      {
        extends: true,
        resolve: {
          alias: { 'server-only': 'next/dist/compiled/server-only/empty.js' },
        },
        test: {
          name: 'node',
          setupFiles: ['./vitest.setup.ts'],
          environment: 'node',
          include: ['**/*.int.test.ts', '**/*.unit.test.ts', ...nodeTsx],
          exclude: [...ignored, ...domTs],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          setupFiles: ['./vitest.setup.ts'],
          environment: 'jsdom',
          include: ['**/*.unit.test.tsx', ...domTs],
          exclude: [...ignored, ...nodeTsx],
        },
      },
      {
        extends: true,
        define: { 'process.env': JSON.stringify({ ...browserEnv, NODE_ENV: 'test' }) },
        optimizeDeps: { entries: browserTests, force: true },
        publicDir: 'node_modules/msw/lib',
        test: {
          name: 'browser',
          include: browserTests,
          exclude: ignored,
          setupFiles: ['./vitest.browser.setup.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium', viewport: { width: 1280, height: 800 } }],
          },
        },
      },
    ],
  },
})
