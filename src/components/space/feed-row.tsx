import { getFormatter, getTranslations } from 'next-intl/server'

import { Avatar } from '@/components/arc/avatar/avatar'
import { Badge } from '@/components/arc/badge/badge'
import type { FeedRow as FeedRowData } from '@/lib/spaces-data'

import { FeedReactions } from './feed-reactions'
import { PostBody } from './post-body'
import styles from './space.module.css'

/** One post in the feed (spec §7): author, kind, body, reactions and the comment count. */
export async function FeedRow({ row, archived }: { row: FeedRowData; archived: boolean }) {
  const [t, format] = await Promise.all([getTranslations('SpacePost'), getFormatter()])
  const { post } = row
  const author = row.authorName ?? t('bySystem')
  return (
    <article id={`post-${post.id}`} className={styles.post}>
      <header className={styles.postHead}>
        <Avatar name={author} size="sm" />
        <span className={styles.rowTitle}>{author}</span>
        <time dateTime={post.createdAt} className={styles.meta}>
          {format.relativeTime(new Date(post.createdAt))}
        </time>
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
      </header>
      <PostBody body={post.body} />
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
        <span className={`${styles.meta} ${styles.numeric}`}>
          {t('comments', { count: row.commentCount })}
        </span>
      </footer>
    </article>
  )
}
