import type { Payload } from 'payload'
import { createHmac } from 'node:crypto'

import { RATE_TABLE } from './names'

export const rateAllowed = async (
  payload: Payload,
  user: number,
  network: string,
  secret: string,
) => {
  const digest = createHmac('sha256', secret).update(network).digest('hex')
  // A global budget remains effective when the proxy does not provide a trustworthy client address.
  const budgets = new Map([
    [`user:${user}`, 45],
    [`network:${digest}`, 180],
    ['global', 600],
  ])
  const result = await payload.db.pool.query<{ key: string; requests: number }>(
    `
    INSERT INTO ${RATE_TABLE} (key, window_start, requests)
    SELECT key, date_trunc('minute', now()), 1 FROM unnest($1::text[]) key
    ON CONFLICT (key) DO UPDATE SET
      requests = CASE WHEN ${RATE_TABLE}.window_start = EXCLUDED.window_start THEN ${RATE_TABLE}.requests + 1 ELSE 1 END,
      window_start = EXCLUDED.window_start
    RETURNING key, requests`,
    [[...budgets.keys()]],
  )
  return result.rows.every((row) => row.requests <= budgets.get(row.key)!)
}
