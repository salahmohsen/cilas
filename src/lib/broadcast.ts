import { resend } from '@/lib/resend'

/**
 * Sends a newsletter issue to a Resend segment (ADR 0005: the list lives in
 * Resend). Resend adds each contact's unsubscribe link where the HTML has
 * {{{RESEND_UNSUBSCRIBE_URL}}}. Returns the broadcast id.
 */
export async function sendBroadcast(args: {
  segmentId: string
  /** People who opted out of this topic are skipped. */
  topicId?: string | null
  from: string
  replyTo: string | null
  subject: string
  html: string
  text: string
  name: string
}): Promise<string> {
  const { ok, status, body } = await resend('/broadcasts', {
    method: 'POST',
    body: JSON.stringify({
      segment_id: args.segmentId,
      ...(args.topicId ? { topic_id: args.topicId } : {}),
      from: args.from,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      subject: args.subject,
      html: args.html,
      text: args.text,
      name: args.name,
      send: true,
    }),
  })
  if (!ok || typeof body.id !== 'string')
    throw new Error((body.message as string) ?? `Resend answered ${status}`)
  return body.id
}
