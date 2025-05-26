import { inferAdditionalFields } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/client';
import { env } from '@/lib/env';

import type { auth } from './auth-server';

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
  baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL
});
