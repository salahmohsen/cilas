import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    hookTimeout: 120_000,
    testTimeout: 120_000,
    unstubGlobals: true,
    include: ['**/*.unit.test.{ts,tsx}', '**/*.int.test.ts'],
    exclude: ['**/node_modules/**', '.next/**'],
    server: {
      deps: {
        inline: ['payload-theme', 'payload-oauth2', 'next-intl'],
      },
    },
  },
})
