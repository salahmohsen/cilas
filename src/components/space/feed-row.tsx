import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { Lock, Megaphone, Pin, Vote } from 'lucide-react'

import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { outsideLinks } from '@/lib/link-preview'
import { absoluteUrl } from '@/lib/schema'
import type { NoticePart } from '@/lib/space-consent'
import type { FeedRow as FeedRowData } from '@/lib/spaces-data'
import type { SpacePost } from '@/payload-types'
import { cairoDay, cairoTime } from '@/lib/cairo-day'
import { eventOver, eventParts } from '@/lib/space-event'

import { EventCard, eventDescription } from './event-card'
import { Folded } from './folded'
import { VotePoll } from './vote-poll'
import { LinkPreviews } from './link-card'
import { PersonHover, type PersonCard } from './person-hover'
import { Attachments } from './attachments'
import { PostActions, type EventEditMenu } from './post-actions'
import { PostBody } from './post-body'
import { PostDialog } from './post-dialog-link'
import { PostFoot } from './post-foot'
import { PostLabels, type PostLabelItem } from './post-label'
import { PostSession } from './post-session'
import type { ThreadViewer } from './space-thread'
import styles from './space.module.css'
import { When } from './when'

/** What every card in one space shares: who reads, who is in it, and what they may do. */
export type FeedContext = {
  archived: boolean
  viewer: ThreadViewer
  moderators: Set<number>
  people: Map<number, PersonCard>
  cards: PersonCard[]
  /** The posting level lets this member comment (spec §7) */
  mayComment: boolean
  consented: boolean
  notice: NoticePart[]
  /** When the page rendered, so client times match the server's */
  now: string
  /** Page titles of the page's bare links, read in one batch */
  titles: Record<string, string>
}

/** Who wrote a post: the photo, then the name (with its card) above when it was posted. */
export async function Byline({
  personId,
  name,
  labelId,
  context,
  when,
}: {
  personId: number | null
  /** The stored author name; null reads as CILAS */
  name: string | null
  /** The id the post is labelled by */
  labelId: string
  context: FeedContext
  when: React.ReactNode
}) {
  const [t, ts] = await Promise.all([getTranslations('SpacePost'), getTranslations('Spaces')])
  const person = personId != null ? context.people.get(personId) : undefined
  const shown = name ?? person?.name ?? t('bySystem')
  const fellow = personId != null && context.moderators.has(personId)
  const label = (
    <button type="button" id={labelId} className={styles.authorButton}>
      <bdi>{shown}</bdi>
    </button>
  )
  return (
    <div className={styles.byline}>
      <Avatar name={shown} src={person?.photo ?? undefined} size="md" />
      <div className={styles.bylineText}>
        <span className={styles.bylineName}>
          {person ? (
            <PersonHover person={{ ...person, name: shown }}>{label}</PersonHover>
          ) : (
            <span id={labelId} className={styles.authorButton}>
              <bdi>{shown}</bdi>
            </span>
          )}
          {fellow && <Badge size="sm">{ts('fellow')}</Badge>}
        </span>
        <span className={styles.meta}>{when}</span>
      </div>
    </div>
  )
}

/** A post's header: the byline, its labels, and the ellipsis menu. Shared by the card and the post page. */
export async function PostHead({
  row,
  context,
  deleted = false,
  postHref,
}: {
  row: FeedRowData
  context: FeedContext
  deleted?: boolean
  /** In the feed: the date opens the post in a dialog, and links here without scripts */
  postHref?: string
}) {
  const t = await getTranslations('SpacePost')
  const { post } = row
  const { viewer, archived } = context
  const mine = row.authorId != null && row.authorId === viewer.personId
  // An event shows no label: its card already carries the calendar leaf.
  const labels = [
    post.pinned && { id: 'pinned', label: t('pinned'), icon: <Pin size={16} /> },
    post.kind === 'announcement' && {
      id: 'announcement',
      label: t('announcement'),
      icon: <Megaphone size={16} />,
      tone: 'info' as const,
    },
    post.kind === 'vote' && { id: 'vote', label: t('kind_vote'), icon: <Vote size={16} /> },
    post.locked && {
      id: 'locked',
      label: t('locked'),
      icon: <Lock size={16} />,
      tone: 'warning' as const,
    },
  ].filter(
    (item): item is Exclude<typeof item, false | null | undefined> => !!item,
  ) satisfies PostLabelItem[]
  return (
    <header className={styles.postHead}>
      <Byline
        personId={row.authorId}
        name={row.authorName}
        labelId={`post-${post.id}-author`}
        context={context}
        when={
          <>
            <When iso={post.createdAt} postHref={postHref} />
            {post.edited_at && ` · ${t('edited')}`}
          </>
        }
      />
      <span className={styles.postLabels}>
        <PostLabels items={labels} />
        {!deleted && (
          <PostActions
            post={{ id: post.id, body: post.body, pinned: !!post.pinned, locked: !!post.locked }}
            canEdit={mine && !archived}
            canModerate={viewer.moderator && !archived}
            canDelete={mine || viewer.moderator}
            event={eventMenu(post, (mine || viewer.moderator) && !archived, context.now)}
          />
        )}
      </span>
    </header>
  )
}

/** What an event post's Edit opens with; `schedule` when this reader may still move it. */
const eventMenu = (post: SpacePost, mayMove: boolean, now: string): EventEditMenu | undefined => {
  if (post.kind !== 'event' || !post.event_starts_at) return undefined
  const { title, description } = eventParts(post)
  const startsAt = post.event_starts_at
  const endsAt = post.event_ends_at ?? null
  const sameDay = !endsAt || cairoDay(endsAt) === cairoDay(startsAt)
  return {
    schedule: mayMove && !post.locked && !eventOver(startsAt, endsAt, new Date(now)),
    initial: {
      title,
      description,
      location: post.event_location ?? '',
      day: cairoDay(startsAt) ?? '',
      time: cairoTime(startsAt) ?? '18:00',
      endTime: endsAt && sameDay ? cairoTime(endsAt) : null,
      cover:
        typeof post.event_cover === 'object' && post.event_cover?.url ? post.event_cover.url : null,
    },
  }
}

/** Whether this member may comment on this post now. */
export const commentsOpen = (row: FeedRowData, context: FeedContext, deleted = false) =>
  context.mayComment && !context.archived && !deleted && !row.post.locked

/**
 * One post in the feed (spec §7). An `article` in the page's `feed`, named by
 * its author and described by its body (W3C feed pattern). Its thread sits
 * under it, so a member replies without leaving the space.
 */
export async function FeedRow({
  row,
  position,
  total,
  context,
  postHref,
}: {
  row: FeedRowData
  position: number
  total: number
  context: FeedContext
  postHref: string
}) {
  const t = await getTranslations('SpacePost')
  const { post } = row
  const id = `post-${post.id}`
  const links = outsideLinks(post.body)
  const text = eventDescription(post)
  return (
    <PostDialog href={postHref} postId={post.id} photos={row.files.some((f) => f.isImage)}>
      <article
        id={id}
        className={styles.post}
        aria-labelledby={`${id}-author`}
        aria-describedby={text || post.kind === 'event' ? `${id}-body` : undefined}
        aria-posinset={position}
        aria-setsize={total}
        tabIndex={-1}
      >
        <PostHead row={row} context={context} postHref={postHref} />
        {post.kind === 'event' && (
          <EventCard
            post={post}
            rsvp={row.rsvp}
            context={context}
            href={postHref}
            descriptionId={`${id}-body`}
          />
        )}
        {text && (
          <div id={`${id}-body`}>
            <Folded body={text} lines={8} more={t('readMore')} less={t('showLess')}>
              <PostBody body={text} people={context.people} titles={context.titles} />
            </Folded>
          </div>
        )}
        {row.session && <PostSession session={row.session} kind={post.kind} postHref={postHref} />}
        {row.vote && (
          <VotePoll
            post={post.id}
            vote={row.vote}
            disabled={context.archived || !!post.locked}
            people={context.people}
          />
        )}
        {links.length > 0 && (
          <Suspense fallback={null}>
            <LinkPreviews urls={links} />
          </Suspense>
        )}
        {row.files.length > 0 && <Attachments files={row.files} label={t('files')} opensPost />}
        <PostFoot
          post={post.id}
          link={absoluteUrl(postHref)}
          reactions={row.reactions}
          comments={row.comments}
          commentCount={row.commentCount}
          people={context.cards}
          viewer={context.viewer}
          canComment={commentsOpen(row, context)}
          archived={context.archived}
          consented={context.consented}
          notice={context.notice}
          now={context.now}
          titles={context.titles}
          preview
        />
      </article>
    </PostDialog>
  )
}
