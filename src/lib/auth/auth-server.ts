import {
  verification,
  account,
  session,
  user
} from '@/drizzle/schema/auth-schema';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { admin } from 'better-auth/plugins/admin';
import { betterAuth } from 'better-auth';
import { db } from '@/drizzle';

import { env } from '../env';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    schema: {
      verification,
      session,
      account,
      user
    },
    debugLogs: true,
    provider: 'pg'
  }),
  socialProviders: {
    google: {
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      clientId: env.GOOGLE_CLIENT_ID
    }
  },
  emailAndPassword: {
    enabled: true
  },
  plugins: [nextCookies(), admin()]
});
