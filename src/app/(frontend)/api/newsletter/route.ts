import * as z from 'zod'

import { env } from '@/env'

const Body = z.object({ email: z.email() })

/**
 * Adds an address to the newsletter list. The list lives in the email
 * service's audience, not in Payload (ADR 0005): no account, and consent and
 * unsubscribes are the provider's job.
 */
export async function POST(request: Request) {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    return Response.json({ error: 'Newsletter signup is not configured' }, { status: 503 })
  }
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const res = await fetch(`https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: parsed.data.email, unsubscribed: false }),
  })
  // Already on the list counts as success: the visitor's intent is met.
  if (!res.ok && res.status !== 409) {
    return Response.json({ error: 'Could not subscribe right now' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
