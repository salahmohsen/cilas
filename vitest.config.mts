import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // getPayload boots the whole config and opens a Postgres pool, which
    // comfortably exceeds vitest's 10s default on a remote database.
    hookTimeout: 120_000,
    testTimeout: 120_000,
    include: [
      'tests/unit/**/*.unit.spec.ts',
      'tests/unit/**/*.unit.spec.tsx',
      'tests/int/**/*.int.spec.ts',
    ],
    server: {
      deps: {
        // payload-theme and payload-oauth2 ship extensionless relative imports
        // (`from './theme'`).
        // Next's bundler resolves those; vitest's native ESM loader does not, so
        // without inlining it every int test fails to import payload.config.
        inline: ['payload-theme', 'payload-oauth2'],
      },
    },
  },
})
