import type { Payload } from 'payload'
import { createHmac } from 'node:crypto'

export const rateAllowed = async (
  payload: Payload,
  user: number,
  network: string,
  secret: string,
) => {
  const digest = createHmac('sha256', secret).update(network).digest('hex')
  // A global budget remains effective when the proxy does not provide a trustworthy client address.
  const keys = [`user:${user}`, `network:${digest}`, 'global']
  const limits = [45, 180, 600]
  const result = await payload.db.pool.query<{ key: string; requests: number }>(
    `
    INSERT INTO spaces_search_rate (key, window_start, requests)
    SELECT key, date_trunc('minute', now()), 1 FROM unnest($1::text[]) key
    ON CONFLICT (key) DO UPDATE SET
      requests = CASE WHEN spaces_search_rate.window_start = EXCLUDED.window_start THEN spaces_search_rate.requests + 1 ELSE 1 END,
      window_start = EXCLUDED.window_start
    RETURNING key, requests`,
    [keys],
  )
  return result.rows.every((row) => row.requests <= limits[keys.indexOf(row.key)])
}
