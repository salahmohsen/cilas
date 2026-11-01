/** The default: PostHog's EU cloud, where CILAS's project lives. */
export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com'

/** Path the site forwards to PostHog, so ad blockers see only the site's own address. */
export const INGEST_PATH = '/ingest'

/**
 * The three PostHog addresses that go with an ingestion host: where events
 * go, where the recorder script comes from, and the dashboard.
 * `https://eu.i.posthog.com` gives `eu-assets.i.posthog.com` and `eu.posthog.com`.
 */
export const posthogHosts = (host?: string) => {
  const { origin, hostname } = new URL(host || DEFAULT_POSTHOG_HOST)
  const region = /^(us|eu)\.i\.posthog\.com$/.exec(hostname)?.[1]
  return {
    ingest: origin,
    assets: region ? `https://${region}-assets.i.posthog.com` : origin,
    ui: region ? `https://${region}.posthog.com` : origin,
  }
}

/** The rewrites that forward `/ingest/*` to PostHog (next.config.ts). Empty without a key. */
export const ingestRewrites = (key: string | undefined, host?: string) => {
  if (!key) return []
  const { ingest, assets } = posthogHosts(host)
  return [
    { source: `${INGEST_PATH}/static/:path*`, destination: `${assets}/static/:path*` },
    { source: `${INGEST_PATH}/array/:path*`, destination: `${assets}/array/:path*` },
    { source: `${INGEST_PATH}/:path*`, destination: `${ingest}/:path*` },
  ]
}
