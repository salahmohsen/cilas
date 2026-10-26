import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'

import type { SpacePost } from '@/payload-types'
import { eventOver, eventParts } from '@/lib/space-event'
import type { RsvpView } from '@/lib/spaces-data'

import { EventDetails, type EventCover } from './event-details'
import type { FeedContext } from './feed-row'
import { Folded } from './folded'
import { PostBody } from './post-body'
import { sessionsFor } from './session-block'
import styles from './space.module.css'

/** The cover a reader may see: the populated file, or nothing when it is gone or out of reach. */
const coverOf = (post: SpacePost): EventCover | null =>
  typeof post.event_cover === 'object' && post.event_cover?.url
    ? { url: post.event_cover.url, tone: post.event_cover_tone ?? null }
    : null

/** The text a post shows under its head: an event's name and description are on its card. */
export const eventDescription = (post: Pick<SpacePost, 'kind' | 'body'>): string =>
  post.kind === 'event' ? '' : post.body

/** An event post's card for a reader: when it has ended and whether its answers are closed live here. */
export async function EventCard({
  post,
  rsvp,
  context,
  href,
  titleHref,
  headingLevel,
  note,
  descriptionId,
  fold = true,
}: {
  post: SpacePost
  rsvp: RsvpView | null
  context: FeedContext
  href: string
  titleHref?: string
  headingLevel?: 2 | 3
  note?: ReactNode
  /** The id the post is described by */
  descriptionId?: string
  /** In the feed and the Events tab a long description folds; the post page shows it whole */
  fold?: boolean
}) {
  if (!post.event_starts_at) return null
  const t = await getTranslations('SpacePost')
  const { viewer } = context
  const { title, description } = eventParts(post)
  const body = (
    <PostBody
      body={description}
      people={context.people}
      titles={context.titles}
      sessions={sessionsFor(context.sessions, href)}
    />
  )
  return (
    <EventDetails
      post={post.id}
      title={title || t('kind_event')}
      titleHref={titleHref}
      headingLevel={headingLevel}
      startsAt={post.event_starts_at}
      endsAt={post.event_ends_at ?? null}
      location={post.event_location ?? ''}
      place={post.event_place ?? null}
      cover={coverOf(post)}
      rsvp={rsvp}
      over={eventOver(post.event_starts_at, post.event_ends_at, new Date(context.now))}
      closed={context.archived || !!post.locked}
      href={href}
      note={note}
      description={
        description.trim() ? (
          <div id={descriptionId} className={styles.eventDescription}>
            {fold ? (
              <Folded body={description} lines={4} more={t('readMore')} less={t('showLess')}>
                {body}
              </Folded>
            ) : (
              body
            )}
          </div>
        ) : null
      }
      people={context.people}
      me={{ personId: viewer.personId, name: viewer.me.name, photo: viewer.me.photo }}
    />
  )
}
