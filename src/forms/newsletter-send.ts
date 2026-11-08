import { relId } from '@/lib/relation'
import type { PayloadHandler, PayloadRequest } from 'payload'

import { isAdminUser } from '@/access'
import { issueForEmail } from '@/emails/issue'
import { newsletterMail } from '@/emails/newsletter'
import { getEmailSettings } from '@/emails/settings'
import { env } from '@/env'
import { sendBroadcast } from '@/lib/broadcast'
import { syncList } from '@/lib/list-sync'
import { LIST_OFF, mailingList, newsletterList } from '@/lib/newsletter-list'
import { accountContactCount, FREE_CONTACT_LIMIT } from '@/lib/resend-contacts'

const issueOf = (req: PayloadRequest, id: number) => issueForEmail(req.payload, id, req)

const guarded =
  (run: (req: PayloadRequest, id: number) => Promise<Response>): PayloadHandler =>
  async (req) => {
    if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
    const id = Number(req.routeParams?.id)
    if (!Number.isInteger(id))
      return Response.json({ error: 'Save the issue first.' }, { status: 404 })
    try {
      return await run(req, id)
    } catch (error) {
      req.payload.logger.error({ err: error, msg: `Newsletter ${id} request failed` })
      return Response.json({ error: (error as Error).message }, { status: 502 })
    }
  }

/** The issue as it stands, to the admin who asked. */
const test = guarded(async (req, id) => {
  const mail = await newsletterMail(
    await issueOf(req, id),
    await getEmailSettings(req.payload, req),
    {
      unsubscribe: `${env.NEXT_PUBLIC_SERVER_URL}/en`,
    },
  )
  const to = req.user!.email
  await req.payload.sendEmail({
    to,
    subject: `[Test] ${mail.subject}`,
    html: mail.html,
    text: mail.text,
  })
  return Response.json({ ok: true, to })
})

/** The issue to every subscriber, once; then it is published to the archive. */
const send = guarded(async (req, id) => {
  const issue = await issueOf(req, id)
  if (issue.sent_at)
    return Response.json({ error: 'This issue was already sent.' }, { status: 409 })
  const chosen = issue.send_to
  const listId = relId(chosen)
  const list = listId
    ? await mailingList(req.payload, listId, req)
    : await newsletterList(req.payload, req)
  if (!list) {
    return Response.json(
      { error: listId ? 'The chosen mailing list has no Resend segment.' : LIST_OFF },
      { status: 503 },
    )
  }
  // A synced list first takes in who joined or left since its last sync.
  if (list.source === 'members') {
    await syncList(req.payload, {
      id: list.id,
      source: list.source,
      segment_id: list.segmentId,
      members: list.members,
    })
  }
  // Resend refuses broadcasts once the account stores more contacts than the plan allows.
  const stored = await accountContactCount()
  if (stored !== null && stored > FREE_CONTACT_LIMIT) {
    return Response.json(
      {
        error: `Resend holds ${stored} contacts; the free plan sends newsletters to ${FREE_CONTACT_LIMIT} at most. Delete unsubscribed contacts in Resend, upgrade the plan, or export the list to Mailchimp (Admin → Subscribers).`,
      },
      { status: 409 },
    )
  }
  const settings = await getEmailSettings(req.payload, req)
  const mail = await newsletterMail(issue, settings, {
    unsubscribe: '{{{RESEND_UNSUBSCRIBE_URL}}}',
  })
  const broadcastId = await sendBroadcast({
    segmentId: list.segmentId,
    topicId: list.topicId,
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
