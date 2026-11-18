import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

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

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
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
          environment: 'node',
          include: ['**/*.int.test.ts', '**/*.unit.test.ts', ...nodeTsx],
          exclude: [...ignored, ...domTs],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['**/*.unit.test.tsx', ...domTs],
          exclude: [...ignored, ...nodeTsx],
        },
      },
    ],
  },
})
