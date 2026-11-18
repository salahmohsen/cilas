import { createHash, timingSafeEqual } from 'node:crypto'

import type { CronResult } from '@/lib/space-cron'

const headers = { 'Cache-Control': 'no-store' }

const reply = (body: Record<string, unknown>, status: number, extra: HeadersInit = {}) =>
  Response.json(body, { status, headers: { ...headers, ...extra } })

/** Hashing first gives equal lengths, so the comparison never leaks the secret's length. */
const sameSecret = (given: string, secret: string) =>
  timingSafeEqual(
    createHash('sha256').update(given).digest(),
    createHash('sha256').update(secret).digest(),
  )

/**
 * The hourly schedule for Spaces (a Dokploy schedule calls it): the email
 * digests in their Cairo hour, and the daily purge. POST only, with
 * `Authorization: Bearer <CRON_SECRET>`. Without a CRON_SECRET it refuses
 * everyone. The answer holds counts only. The route gives it the secret and
 * the job.
 */
export async function handleSpacesCron(
  request: Request,
  { secret, run }: { secret: string | undefined; run: () => Promise<CronResult> },
) {
  if (!secret) return reply({ error: 'Not configured' }, 503)
  const given = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!given || !sameSecret(given, secret)) {
    return reply({ error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' })
  }
  try {
    const result = await run()
    return result.busy ? reply({ status: 'busy' }, 409) : reply({ status: 'ok', ...result }, 200)
  } catch {
    console.error('Spaces cron failed')
    return reply({ status: 'failed' }, 500)
  }
}

export const refuseSpacesCronMethod = () =>
  reply({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
