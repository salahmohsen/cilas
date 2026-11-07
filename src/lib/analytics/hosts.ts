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

export const ingestRewrites = (key: string | undefined, host?: string) => {
  if (!key) return []
  const { ingest, assets } = posthogHosts(host)
  return [
    { source: `${INGEST_PATH}/static/:path*`, destination: `${assets}/static/:path*` },
    { source: `${INGEST_PATH}/array/:path*`, destination: `${assets}/array/:path*` },
    { source: `${INGEST_PATH}/:path*`, destination: `${ingest}/:path*` },
  ]
}
