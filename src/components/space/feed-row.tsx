import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { Paperclip } from 'lucide-react'

import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'
import { firstLink } from '@/lib/link-preview'
import { absoluteUrl } from '@/lib/schema'
import type { NoticePart } from '@/lib/space-consent'
import type { FeedRow as FeedRowData, SpaceFileRef } from '@/lib/spaces-data'

import { EventDetails } from './event-details'
import { VotePoll } from './vote-poll'
import { LinkCard } from './link-card'
import { PersonHover, type PersonCard } from './person-hover'
import { PostActions } from './post-actions'
import { PostBody } from './post-body'
import { PostFoot } from './post-foot'
import type { ThreadViewer } from './space-thread'
import styles from './space.module.css'
import { When } from './when'

/**
 * Arc's expandable text starts folded until it measures in the browser, so a
 * short body would flash a "Read more". Only a body that can pass the clamp
 * (about 90 characters a line, or one line per break) gets the fold.
 */
const Folded = ({
  body,
  lines,
  more,
  less,
  children,
}: {
  body: string
  lines: number
  more: string
  less: string
  children: React.ReactNode
}) =>
  body.length > lines * 90 || body.split('\n').length > lines ? (
    <ExpandableText lines={lines} moreLabel={more} lessLabel={less}>
      {children}
    </ExpandableText>
  ) : (
    children
  )

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
}

/** A private file on a post or comment, as a chip that downloads it. */
export function FileChip({ file }: { file: SpaceFileRef }) {
  return (
    <a href={file.url} className={styles.fileChip} download={file.name}>
      <Paperclip size={14} aria-hidden="true" />
      <bdi>{file.name}</bdi>
      <span className={styles.meta}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
    </a>
  )
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
}: {
  row: FeedRowData
  context: FeedContext
  deleted?: boolean
}) {
  const t = await getTranslations('SpacePost')
  const { post } = row
  const { viewer, archived } = context
  const mine = row.authorId != null && row.authorId === viewer.personId
  return (
    <header className={styles.postHead}>
      <Byline
        personId={row.authorId}
        name={row.authorName}
        labelId={`post-${post.id}-author`}
        context={context}
        when={
          <>
            <When iso={post.createdAt} />
            {post.edited_at && ` · ${t('edited')}`}
          </>
        }
      />
      <span className={styles.postLabels}>
        {post.pinned && <Badge size="sm">{t('pinned')}</Badge>}
        {post.kind === 'announcement' && (
          <Badge size="sm" tone="info">
            {t('announcement')}
          </Badge>
        )}
        {(post.kind === 'event' || post.kind === 'vote') && (
          <Badge size="sm">{t(`kind_${post.kind}`)}</Badge>
        )}
        {post.locked && (
          <Badge size="sm" tone="warning">
            {t('locked')}
          </Badge>
        )}
        {!deleted && (
          <PostActions
            post={{ id: post.id, body: post.body, pinned: !!post.pinned, locked: !!post.locked }}
            canEdit={mine && !archived}
            canModerate={viewer.moderator && !archived}
            canDelete={mine || viewer.moderator}
          />
        )}
      </span>
    </header>
  )
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
  const link = firstLink(post.body)
  return (
    <article
      id={id}
      className={styles.post}
      aria-labelledby={`${id}-author`}
      aria-describedby={`${id}-body`}
      aria-posinset={position}
      aria-setsize={total}
      tabIndex={-1}
    >
      <PostHead row={row} context={context} />
      <div id={`${id}-body`}>
        <Folded body={post.body} lines={8} more={t('readMore')} less={t('showLess')}>
          <PostBody body={post.body} people={context.people} />
        </Folded>
      </div>
      {post.kind === 'event' && post.event_starts_at && (
        <EventDetails startsAt={post.event_starts_at} location={post.event_location ?? ''} />
      )}
      {row.vote && (
        <VotePoll post={post.id} vote={row.vote} disabled={context.archived || !!post.locked} />
      )}
      {link && (
        <Suspense fallback={null}>
          <LinkCard url={link} />
        </Suspense>
      )}
      {row.files.length > 0 && (
        <div className={styles.files} aria-label={t('files')} role="group">
          {row.files.map((f) => (
            <FileChip key={f.id} file={f} />
          ))}
        </div>
      )}
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
        preview
      />
    </article>
  )
}
