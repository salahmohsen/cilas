import { parseRows } from './stats'

export type PostHogQueryConfig = {
  /** `https://eu.posthog.com`: the app host, not the ingestion host. */
  apiHost: string
  projectId: string
  /** A personal API key with the Query read scope. Server only. */
  apiKey: string
}

type Environment = Record<string, string | undefined>

/** The three settings the dashboard needs, or null (then its widgets hide). */
export const queryConfig = (env: Environment = process.env): PostHogQueryConfig | null => {
  const apiHost = env.POSTHOG_API_HOST?.trim().replace(/\/+$/, '')
  const projectId = env.POSTHOG_PROJECT_ID?.trim()
  const apiKey = env.POSTHOG_PERSONAL_API_KEY?.trim()
  return apiHost && projectId && apiKey ? { apiHost, projectId, apiKey } : null
}

export const QUERY_TIMEOUT_MS = 5000

/**
 * Runs one HogQL query and returns its rows. Throws on a timeout, a failed
 * status or an answer of the wrong shape; the caller hides the widget. The
 * error text names the status only: never the key, never PostHog's body.
 */
export const runQuery = async (
  config: PostHogQueryConfig,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ReturnType<typeof parseRows>> => {
  const response = await fetchImpl(`${config.apiHost}/api/projects/${config.projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'cilas-dashboard',
      query: { kind: 'HogQLQuery', query: query.replace(/\s+/g, ' ').trim() },
    }),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`PostHog query failed with status ${response.status}`)
  return parseRows(await response.json())
}
