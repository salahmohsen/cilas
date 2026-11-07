/**
 * The public settings, for code that runs in the browser. src/env.ts checks
 * them with zod when the app builds and starts (next.config.ts imports it);
 * read here, plainly, they keep zod out of the browser's bundle. Next writes
 * each NEXT_PUBLIC_ value in at build time, so each is named in full. The
 * defaults live here and src/env.ts uses them, and a blank value counts as unset there too.
 */
export const clientDefaults = {
  NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
  NEXT_PUBLIC_TYPESENSE_HOST: 'localhost',
  NEXT_PUBLIC_TYPESENSE_PORT: 8108,
  NEXT_PUBLIC_TYPESENSE_PROTOCOL: 'http',
  /** PostHog's EU cloud, where CILAS's project lives. */
  NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
} as const

export const clientEnv = {
  NEXT_PUBLIC_SERVER_URL:
    process.env.NEXT_PUBLIC_SERVER_URL || clientDefaults.NEXT_PUBLIC_SERVER_URL,
  NEXT_PUBLIC_TYPESENSE_HOST:
    process.env.NEXT_PUBLIC_TYPESENSE_HOST || clientDefaults.NEXT_PUBLIC_TYPESENSE_HOST,
  NEXT_PUBLIC_TYPESENSE_PORT: Number(
    process.env.NEXT_PUBLIC_TYPESENSE_PORT || clientDefaults.NEXT_PUBLIC_TYPESENSE_PORT,
  ),
  NEXT_PUBLIC_TYPESENSE_PROTOCOL: (process.env.NEXT_PUBLIC_TYPESENSE_PROTOCOL ||
    clientDefaults.NEXT_PUBLIC_TYPESENSE_PROTOCOL) as 'http' | 'https',
  NEXT_PUBLIC_TYPESENSE_API_KEY: process.env.NEXT_PUBLIC_TYPESENSE_API_KEY || undefined,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || undefined,
}
