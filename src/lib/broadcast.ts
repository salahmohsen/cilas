/**
 * Sends a newsletter issue to a Resend segment (ADR 0005: the list lives in
 * Resend). Resend adds each contact's unsubscribe link where the HTML has
 * {{{RESEND_UNSUBSCRIBE_URL}}}. Returns the broadcast id.
 */
export async function sendBroadcast(args: {
  apiKey: string
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
  const res = await fetch('https://api.resend.com/broadcasts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
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
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!res.ok || !body.id) throw new Error(body.message ?? `Resend answered ${res.status}`)
  return body.id
}
