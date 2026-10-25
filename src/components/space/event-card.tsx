import type { SpacePost } from '@/payload-types'
import { eventOver } from '@/lib/space-event'
import type { RsvpView } from '@/lib/spaces-data'

import { EventDetails } from './event-details'
import type { FeedContext } from './feed-row'

/** An event post's card for a reader: the rules for who may change it and when it has ended live here. */
export function EventCard({
  post,
  rsvp,
  context,
  href,
}: {
  post: SpacePost
  rsvp: RsvpView | null
  context: FeedContext
  href: string
}) {
  if (!post.event_starts_at) return null
  const { viewer } = context
  const author = typeof post.author === 'object' && post.author ? post.author.id : post.author
  const mine = viewer.personId !== null && author === viewer.personId
  return (
    <EventDetails
      post={post.id}
      body={post.body}
      startsAt={post.event_starts_at}
      endsAt={post.event_ends_at ?? null}
      location={post.event_location ?? ''}
      rsvp={rsvp}
      over={eventOver(post.event_starts_at, post.event_ends_at, new Date(context.now))}
      closed={context.archived || !!post.locked}
      canChange={(mine || viewer.moderator) && !context.archived}
      href={href}
      people={context.people}
      me={{ personId: viewer.personId, name: viewer.me.name, photo: viewer.me.photo }}
    />
  )
}
