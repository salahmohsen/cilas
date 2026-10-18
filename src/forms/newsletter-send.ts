import type { PayloadHandler, PayloadRequest } from 'payload'

import { isAdminUser } from '@/access'
import { newsletterMail, type Issue } from '@/emails/newsletter'
import { getEmailSettings } from '@/emails/settings'
import { env } from '@/env'
import { sendBroadcast } from '@/lib/broadcast'

/** The issue's latest draft, its picks populated for the cards. */
const issueOf = async (req: PayloadRequest, id: number) =>
  (await req.payload.findByID({
    collection: 'newsletters',
    id,
    depth: 2,
    draft: true,
    locale: 'en',
    overrideAccess: true,
    req,
  })) as Issue & { title: string; sent_at?: string | null }

const guarded =
  (run: (req: PayloadRequest, id: number) => Promise<Response>): PayloadHandler =>
  async (req) => {
    if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id)) return Response.json({ error: 'Save the issue first.' }, { status: 404 })
    try {
      return await run(req, id)
    } catch (error) {
      req.payload.logger.error({ err: error, msg: `Newsletter ${id} failed to send` })
      return Response.json({ error: (error as Error).message }, { status: 502 })
    }
  }

/** The issue as it stands, to the admin who asked. */
const test = guarded(async (req, id) => {
  const mail = await newsletterMail(await issueOf(req, id), await getEmailSettings(req.payload, req), {
    site: env.NEXT_PUBLIC_SERVER_URL,
    unsubscribe: `${env.NEXT_PUBLIC_SERVER_URL}/en`,
  })
  const to = req.user!.email
  await req.payload.sendEmail({ to, subject: `[Test] ${mail.subject}`, html: mail.html, text: mail.text })
  return Response.json({ ok: true, to })
})

/** The issue to every subscriber, once; then it is published to the archive. */
const send = guarded(async (req, id) => {
  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    return Response.json(
      { error: 'Sending is off: RESEND_API_KEY or RESEND_AUDIENCE_ID is not set.' },
      { status: 503 },
    )
  }
  const issue = await issueOf(req, id)
  if (issue.sent_at) return Response.json({ error: 'This issue was already sent.' }, { status: 409 })
  const settings = await getEmailSettings(req.payload, req)
  const mail = await newsletterMail(issue, settings, {
    site: env.NEXT_PUBLIC_SERVER_URL,
    unsubscribe: '{{{RESEND_UNSUBSCRIBE_URL}}}',
  })
  const broadcastId = await sendBroadcast({
    apiKey: env.RESEND_API_KEY,
    segmentId: env.RESEND_AUDIENCE_ID,
    from: `${settings.fromName} <${env.EMAIL_FROM_ADDRESS}>`,
    replyTo: settings.replyTo,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    name: issue.title,
  })
  await req.payload.update({
    collection: 'newsletters',
    id,
    data: { _status: 'published', sent_at: new Date().toISOString(), broadcast_id: broadcastId },
    overrideAccess: true,
    req,
  })
  return Response.json({ ok: true, broadcastId })
})

export const newsletterEndpoints = [
  { path: '/:id/test', method: 'post' as const, handler: test },
  { path: '/:id/send', method: 'post' as const, handler: send },
]
