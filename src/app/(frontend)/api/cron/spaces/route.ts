import { createHash, timingSafeEqual } from 'node:crypto'

import config from '@payload-config'
import { getPayload } from 'payload'

import { env } from '@/env'
import { runSpacesCron } from '@/lib/space-cron'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
 * everyone. The answer holds counts only.
 */
export async function POST(request: Request) {
  const secret = env.CRON_SECRET
  if (!secret) return reply({ error: 'Not configured' }, 503)
  const given = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!given || !sameSecret(given, secret)) {
    return reply({ error: 'Unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' })
  }
  try {
    const result = await runSpacesCron(await getPayload({ config }))
    return result.busy ? reply({ status: 'busy' }, 409) : reply({ status: 'ok', ...result }, 200)
  } catch {
    console.error('Spaces cron failed')
    return reply({ status: 'failed' }, 500)
  }
}

const refuse = () => reply({ error: 'Method not allowed' }, 405, { Allow: 'POST' })
export { refuse as GET, refuse as PUT, refuse as PATCH, refuse as DELETE }
