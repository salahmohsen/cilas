import * as z from 'zod'

import { env } from '@/env'
import { subscribe } from '@/lib/resend-contacts'

const Body = z.object({ email: z.email() })

/**
 * Adds an address to the newsletter list. The list lives in the email
 * service's segment, not in Payload (ADR 0005): no account, and consent and
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

  // An address already on the list counts as success: the visitor's intent is met.
  const ok = await subscribe(env.RESEND_API_KEY, env.RESEND_AUDIENCE_ID, parsed.data.email).catch(() => false)
  if (!ok) {
    return Response.json({ error: 'Could not subscribe right now' }, { status: 502 })
  }
  return Response.json({ ok: true })
}
