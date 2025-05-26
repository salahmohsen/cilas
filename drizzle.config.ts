import type { Config } from 'drizzle-kit';

import { defineConfig } from 'drizzle-kit';

import { env } from './src/lib/env';

export default defineConfig({
  dbCredentials: {
    url: env.NEON_DATABASE_URL
  },
  out: './src/drizzle/migrations',
  schema: './src/drizzle/schema',
  dialect: 'postgresql',
  verbose: true,
  strict: true
}) satisfies Config;
