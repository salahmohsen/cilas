import { relId } from '@/lib/relation'
import config from '@payload-config'
import { getPayload } from 'payload'

import { currentReader } from '@/lib/reader'
import { absoluteUrl } from '@/lib/schema'
import { eventName, icsFor } from '@/lib/space-event'
import { spaceLink } from '@/lib/space-ref'

/**
 * One event post as an iCalendar file. The post is read through the reader's
 * access, so a reader gets a file only for an event they could open. The UID
 * belongs to the post, so adding it twice updates one entry. Stored times are
 * instants (the Cairo wall-clock converted when the event was saved), so the
 * file is in UTC.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, currentReader()])
  const postId = Number(id)
  if (!user) return new Response('Sign in to add this event.', { status: 401 })
  if (!Number.isInteger(postId)) return new Response('Not found', { status: 404 })
  const payload = await getPayload({ config })
  const post = await payload
    .findByID({
      collection: 'space-posts',
      id: postId,
      user,
      depth: 0,
      overrideAccess: false,
    })
    .catch(() => null)
  if (!post || post.kind !== 'event' || post.deleted_at || !post.event_starts_at)
    return new Response('Not found', { status: 404 })
  const spaceId = relId(post.space)
  const space = await payload.findByID({ collection: 'spaces', id: spaceId, depth: 0 })
  const locale = new URL(request.url).searchParams.get('locale') === 'ar' ? 'ar' : 'en'
  const link = absoluteUrl(`/${locale}${await spaceLink(payload, space, post.id)}`)
  const body = icsFor({
    uid: `space-post-${post.id}@cilas.org`,
    title: eventName(post, 'CILAS event'),
    startsAt: post.event_starts_at,
    endsAt: post.event_ends_at,
    location: post.event_location ?? '',
    url: link,
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="cilas-event-${post.id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
