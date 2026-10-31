import { createEnv } from '@t3-oss/env-nextjs'
import * as z from 'zod'

// Match Next's local overrides for scripts too. Explicit environment wins;
// tests use only their supplied environment and .env, as Next does.
if (process.env.NODE_ENV === 'development') {
  try {
    process.loadEnvFile('.env.development.local')
  } catch {}
}
if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile('.env.local')
  } catch {}
}
try {
  process.loadEnvFile('.env')
} catch {}

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    // Optional: a direct (session) connection for the live notifications'
    // LISTEN, when DATABASE_URL goes through a transaction pooler.
    DATABASE_LISTEN_URL: z.url().optional(),
    PAYLOAD_SECRET: z.string().min(1),

    // disableLocalStorage is on, so there is no local fallback for these.
    R2_BUCKET: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_ENDPOINT: z.url(),
    R2_PUBLIC_URL: z.url(),
    R2_REGION: z.string().min(1).default('auto'),

    // Optional: without it Payload logs emails to the console (fine in dev).
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM_ADDRESS: z.email().default('noreply@ci-las.org'),

    // Optional: "Continue with Google" on the login page. Without both, the
    // button is hidden. Callback: <NEXT_PUBLIC_SERVER_URL>/api/users/oauth/google/callback
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    TMDB_API_READ_TOKEN: z.string().min(1).optional(),

    // Optional: Cloudflare Turnstile's secret. With it, /api/form-submissions
    // refuses a post without a good token. Set it with the site key below.
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),

    PRIVATE_SPACES_SEARCH: z.enum(['true', 'false']).default('false'),
    PRIVATE_SPACES_SEARCH_KEYS_VERIFIED: z.enum(['true', 'false']).default('false'),
    TYPESENSE_PRIVATE_SEARCH_KEY: z.string().min(1).optional(),
    TYPESENSE_PRIVATE_WRITE_KEY: z.string().min(1).optional(),
    TYPESENSE_PRIVATE_HOST: z.string().optional(),
    TYPESENSE_PRIVATE_PORT: z.coerce.number().optional(),
    TYPESENSE_PRIVATE_PROTOCOL: z.enum(['http', 'https']).optional(),
    TYPESENSE_API_KEY: z.string().min(1).optional(),
    TYPESENSE_HOST: z.string().default('localhost'),
    TYPESENSE_PORT: z.coerce.number().default(8108),
    TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('http'),
  },

  // Read by the admin live-preview iframe, which postMessages back to Payload.
  // Payload matches messages with `event.origin === serverURL`, so this must
  // be a real absolute origin. The admin and frontend share one in
  // development, so it is only needed when they are deployed separately.
  client: {
    NEXT_PUBLIC_SERVER_URL: z.string().url().default('http://localhost:3000'),

    // Where the browser asks Typesense directly (InstantSearch). Needs a
    // public Typesense address and a search-only API key — never the admin
    // key — scoped to the search collections and their generations:
    //   { "actions": ["documents:search"],
    //     "collections": ["^(courses|articles|people)(_[0-9a-f]{8})?$"] }
    // Without the key the site hides the search field entirely.
    NEXT_PUBLIC_TYPESENSE_HOST: z.string().default('localhost'),
    NEXT_PUBLIC_TYPESENSE_PORT: z.coerce.number().default(8108),
    NEXT_PUBLIC_TYPESENSE_PROTOCOL: z.enum(['http', 'https']).default('http'),
    NEXT_PUBLIC_TYPESENSE_API_KEY: z.string().min(1).optional(),

    // The Turnstile widget on the site's forms. Without it the forms send no
    // token, so a set TURNSTILE_SECRET_KEY would refuse every submission.
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
  },

  experimental__runtimeEnv: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,

    NEXT_PUBLIC_TYPESENSE_HOST: process.env.NEXT_PUBLIC_TYPESENSE_HOST,
    NEXT_PUBLIC_TYPESENSE_PORT: process.env.NEXT_PUBLIC_TYPESENSE_PORT,
    NEXT_PUBLIC_TYPESENSE_PROTOCOL: process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
    NEXT_PUBLIC_TYPESENSE_API_KEY: process.env.NEXT_PUBLIC_TYPESENSE_API_KEY,

    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  },

  // Stops a blank R2_SECRET_ACCESS_KEY in .env passing as an empty string and
  // failing later inside the AWS SDK.
  emptyStringAsUndefined: true,
})

if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  const storage = new URL(env.R2_ENDPOINT)
  if (storage.protocol !== 'https:' || !storage.hostname.endsWith('.r2.cloudflarestorage.com')) {
    throw new Error('Production storage must use a Cloudflare R2 HTTPS endpoint')
  }
}
