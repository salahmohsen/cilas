import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { playwright } from '@vitest/browser-playwright'

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
          include: ['**/*.{int,unit}.test.{ts,tsx}'],
          exclude: ignored,
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          setupFiles: ['./vitest.setup.ts'],
          environment: 'jsdom',
          include: ['**/*.dom.test.{ts,tsx}'],
          exclude: ignored,
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
