import { clientDefaults } from '../../env.client'

/**
 * Path the site forwards to PostHog, so ad blockers see only the site's own
 * address. PostHog advises against obvious names (/analytics, /tracking,
 * /posthog, /ingest), which blockers learn, so this one is arbitrary.
 */
export const INGEST_PATH = '/relay-k3'

/**
 * The three PostHog addresses that go with an ingestion host: where events
 * go, where the recorder script comes from, and the dashboard.
 * `https://eu.i.posthog.com` gives `eu-assets.i.posthog.com` and `eu.posthog.com`.
 */
export const posthogHosts = (host?: string) => {
  const { origin, hostname } = new URL(host || clientDefaults.NEXT_PUBLIC_POSTHOG_HOST)
  const region = /^(us|eu)\.i\.posthog\.com$/.exec(hostname)?.[1]
  return {
    ingest: origin,
    assets: region ? `https://${region}-assets.i.posthog.com` : origin,
    ui: region ? `https://${region}.posthog.com` : origin,
  }
}

/**
 * Where a relay request goes, and with which headers, or null when the path is
 * not the relay or analytics is off. PostHog reads the visitor's address from
 * `X-Forwarded-For`, but behind Cloudflare and Traefik that header names the
 * proxy (10.0.1.191 in production), which broke GeoIP and would make every
 * visitor share one cookieless hash. Cloudflare's `cf-connecting-ip` is the
 * visitor. The site's cookies, the login among them, never leave. `path`
 * keeps its query string, which PostHog uses.
 */
export const relayRequest = (
  path: string,
  incoming: Headers,
  key: string | undefined,
  host?: string,
): { url: string; headers: Headers } | null => {
  if (!key || !path.startsWith(`${INGEST_PATH}/`)) return null
  const { ingest, assets } = posthogHosts(host)
  const rest = path.slice(INGEST_PATH.length)
  const origin = /^\/(static|array)\//.test(rest) ? assets : ingest
  const headers = new Headers(incoming)
  headers.delete('cookie')
  const visitor =
    incoming.get('cf-connecting-ip') ?? incoming.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (visitor) headers.set('x-forwarded-for', visitor)
  return { url: `${origin}${rest}`, headers }
}
