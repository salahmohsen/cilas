import { unstable_cache } from 'next/cache'

import { QUERIES, type QueryName } from '@/lib/analytics/queries'
import { queryConfig, runQuery } from '@/lib/analytics/posthog-query'

import { STATS_TAG } from './cached'

/** How long a PostHog answer is reused. Every admin shares it. */
const POSTHOG_CACHE_SECONDS = 600

/** The analytics widgets show only when the three PostHog settings are there. */
export const analyticsConfigured = (): boolean => queryConfig() !== null

/** One named query's rows, read once per ten minutes. Throws when PostHog fails or is slow: the widget hides. */
export const posthogRows = (name: QueryName) => {
  const config = queryConfig()
  if (!config) return Promise.reject(new Error('PostHog is not set up'))
  return unstable_cache(() => runQuery(config, QUERIES[name]), ['posthog-query', name], {
    revalidate: POSTHOG_CACHE_SECONDS,
    tags: [STATS_TAG],
  })()
}

/** A page in PostHog's own app, for the "Open in PostHog" links. */
export const posthogLink = (path: string): string | null => {
  const config = queryConfig()
  return config ? `${config.apiHost}/project/${config.projectId}/${path}` : null
}
