/**
 * Runs every dashboard query once against the real PostHog project and prints
 * how many rows each returned, so a wrong column name or HogQL mistake shows
 * up before an admin sees an empty widget.
 *
 *   POSTHOG_API_HOST=https://eu.posthog.com POSTHOG_PROJECT_ID=... \
 *   POSTHOG_PERSONAL_API_KEY=... pnpm analytics:check
 *
 * Prints counts only, never the rows or the key.
 */
import { queryConfig, runQuery } from '../src/lib/analytics/posthog-query'
import { QUERIES, type QueryName } from '../src/lib/analytics/queries'

const config = queryConfig()
if (!config) {
  console.error('Set POSTHOG_API_HOST, POSTHOG_PROJECT_ID and POSTHOG_PERSONAL_API_KEY.')
  process.exit(2)
}

let failed = 0
for (const name of Object.keys(QUERIES) as QueryName[]) {
  try {
    const rows = await runQuery(config, QUERIES[name])
    console.log(`ok    ${name.padEnd(10)} ${rows.length} rows`)
  } catch (error) {
    failed++
    console.log(`FAIL  ${name.padEnd(10)} ${error instanceof Error ? error.message : error}`)
  }
}
process.exit(failed ? 1 : 0)
