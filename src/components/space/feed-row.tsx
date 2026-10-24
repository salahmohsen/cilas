import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import { CopyButton } from '@/components/arc/copy-button/copy-button'
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'
import { HoverCard, HoverCardProfile } from '@/components/arc/hover-card/hover-card'
import { absoluteUrl } from '@/lib/schema'
import type { FeedRow as FeedRowData } from '@/lib/spaces-data'

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
}: {
  body: string
  lines: number
  more: string
  less: string
}) =>
  body.length > lines * 90 || body.split('\n').length > lines ? (
    <ExpandableText lines={lines} moreLabel={more} lessLabel={less}>
      <PostBody body={body} />
    </ExpandableText>
  ) : (
    <PostBody body={body} />
  )

export type Person = { name: string; photo: string | null }

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
  viewer: { personId: number | null; moderator: boolean }
  moderators: Set<number>
  people: Map<number, Person>
  postHref: string
}) {
  const [t, ts] = await Promise.all([getTranslations('SpacePost'), getTranslations('Spaces')])
  const { post } = row
  const author = row.authorId != null ? people.get(row.authorId) : undefined
  const name = row.authorName ?? t('bySystem')
  const fellow = row.authorId != null && moderators.has(row.authorId)
  const mine = row.authorId != null && row.authorId === viewer.personId
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
      <header className={styles.postHead}>
        <Avatar name={name} src={author?.photo ?? undefined} size="sm" />
        <HoverCard
          content={
            <HoverCardProfile
              name={name}
              avatar={author?.photo ?? undefined}
              role={fellow ? ts('fellow') : ts('member')}
            />
          }
        >
          <button type="button" id={`${id}-author`} className={styles.authorButton}>
            <bdi>{name}</bdi>
          </button>
        </HoverCard>
        {fellow && <Badge size="sm">{ts('fellow')}</Badge>}
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
        <span className={styles.postActions}>
          <PostActions
            post={{ id: post.id, body: post.body, pinned: !!post.pinned, locked: !!post.locked }}
            canEdit={mine && !archived}
            canModerate={viewer.moderator && !archived}
            canDelete={mine || viewer.moderator}
          />
        </span>
      </header>
      <div id={`${id}-body`}>
        <Folded body={post.body} lines={8} more={t('readMore')} less={t('showLess')} />
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
                  <Folded body={c.body} lines={2} more={t('readMore')} less={t('showLess')} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <footer className={styles.postFoot}>
        <FeedReactions
          post={post.id}
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
