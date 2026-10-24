import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { CopyButton } from '@/components/arc/copy-button/copy-button'
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'
import { HoverCard, HoverCardProfile } from '@/components/arc/hover-card/hover-card'
import { absoluteUrl } from '@/lib/schema'
import type { FeedRow as FeedRowData } from '@/lib/spaces-data'

import { CommentBody } from './comment-body'
import { FeedReactions } from './feed-reactions'
import { PostActions } from './post-actions'
import { PostBody } from './post-body'
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

export type Person = { name: string; photo: string | null }

/** Who wrote a post or comment: photo, name with a profile card, and the Fellow badge. */
export async function Byline({
  personId,
  name,
  labelId,
  people,
  moderators,
}: {
  personId: number | null
  /** The stored author name; null reads as CILAS */
  name: string | null
  /** The id the post or comment is labelled by */
  labelId: string
  people: Map<number, Person>
  moderators: Set<number>
}) {
  const [t, ts] = await Promise.all([getTranslations('SpacePost'), getTranslations('Spaces')])
  const person = personId != null ? people.get(personId) : undefined
  const shown = name ?? person?.name ?? t('bySystem')
  const fellow = personId != null && moderators.has(personId)
  return (
    <>
      <Avatar name={shown} src={person?.photo ?? undefined} size="sm" />
      <HoverCard
        content={
          <HoverCardProfile
            name={shown}
            avatar={person?.photo ?? undefined}
            role={fellow ? ts('fellow') : ts('member')}
          />
        }
      >
        <button type="button" id={labelId} className={styles.authorButton}>
          <bdi>{shown}</bdi>
        </button>
      </HoverCard>
      {fellow && <Badge size="sm">{ts('fellow')}</Badge>}
    </>
  )
}

type Viewer = { personId: number | null; moderator: boolean }

/** A post's header line, shared by the feed card and the post page. */
export async function PostHead({
  row,
  archived,
  viewer,
  moderators,
  people,
  deleted = false,
}: {
  row: FeedRowData
  archived: boolean
  viewer: Viewer
  moderators: Set<number>
  people: Map<number, Person>
  deleted?: boolean
}) {
  const t = await getTranslations('SpacePost')
  const { post } = row
  const mine = row.authorId != null && row.authorId === viewer.personId
  return (
    <header className={styles.postHead}>
      <Byline
        personId={row.authorId}
        name={row.authorName}
        labelId={`post-${post.id}-author`}
        people={people}
        moderators={moderators}
      />
      <When iso={post.createdAt} className={styles.meta} />
      {post.edited_at && <span className={styles.meta}>{t('edited')}</span>}
      {post.pinned && <Badge size="sm">{t('pinned')}</Badge>}
      {post.kind === 'announcement' && (
        <Badge size="sm" tone="info">
          {t('announcement')}
        </Badge>
      )}
      {post.locked && (
        <Badge size="sm" tone="warning">
          {t('locked')}
        </Badge>
      )}
      {!deleted && (
        <span className={styles.postActions}>
          <PostActions
            post={{ id: post.id, body: post.body, pinned: !!post.pinned, locked: !!post.locked }}
            canEdit={mine && !archived}
            canModerate={viewer.moderator && !archived}
            canDelete={mine || viewer.moderator}
          />
        </span>
      )}
    </header>
  )
}

/**
 * One post in the feed (spec §7). An `article` in the page's `feed`, named by
 * its author and described by its body (W3C feed pattern).
 */
export async function FeedRow({
  row,
  position,
  total,
  archived,
  viewer,
  moderators,
  people,
  postHref,
}: {
  row: FeedRowData
  position: number
  total: number
  archived: boolean
  viewer: Viewer
  moderators: Set<number>
  people: Map<number, Person>
  postHref: string
}) {
  const t = await getTranslations('SpacePost')
  const { post } = row
  const id = `post-${post.id}`
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
      <PostHead
        row={row}
        archived={archived}
        viewer={viewer}
        moderators={moderators}
        people={people}
      />
      <div id={`${id}-body`}>
        <Folded body={post.body} lines={8} more={t('readMore')} less={t('showLess')}>
          <PostBody body={post.body} />
        </Folded>
      </div>
      {row.latestComments.length > 0 && (
        <ul className={styles.memberList}>
          {row.latestComments.map((c) => {
            const who = c.authorId != null ? people.get(c.authorId) : undefined
            return (
              <li key={c.id} className={styles.memberRow}>
                <Avatar name={who?.name ?? t('bySystem')} src={who?.photo ?? undefined} size="sm" />
                <span className={styles.rowText}>
                  <span className={styles.meta}>
                    <bdi>{who?.name ?? t('bySystem')}</bdi>
                  </span>
                  <Folded body={c.body} lines={2} more={t('readMore')} less={t('showLess')}>
                    <CommentBody body={c.body} />
                  </Folded>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <footer className={styles.postFoot}>
        <FeedReactions
          target={{ post: post.id }}
          counts={row.reactions.counts}
          mine={row.reactions.mine}
          disabled={archived}
          labels={{
            agree: t('reaction_agree'),
            thank_you: t('reaction_thank_you'),
            insightful: t('reaction_insightful'),
            same_question: t('reaction_same_question'),
          }}
        />
        <span className={styles.rowMain}>
          <Link href={postHref} className={styles.link}>
            {row.commentCount > 0 ? t('comments', { count: row.commentCount }) : t('addComment')}
          </Link>
          <CopyButton
            value={absoluteUrl(postHref)}
            label={t('copyLink')}
            iconOnly
            variant="plain"
          />
        </span>
      </footer>
    </article>
  )
}
