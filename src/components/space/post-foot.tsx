'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Link2, MessageCircle } from 'lucide-react'

import { ExpandingButtonGroup } from '@/components/arc/expanding-button-group/expanding-button-group'
import type { NoticePart } from '@/lib/space-consent'
import type { ReactionCounts, ReactionKind } from '@/lib/space-reactions'
import type { TopComment } from '@/lib/spaces-data'

import { FeedReactions } from './feed-reactions'
import { COMMENT_EVENT } from './intro-lock'
import type { PersonCard } from './person-hover'
import type { SessionLinks } from './session-chip'
import styles from './space.module.css'
import { SpaceThread, type ThreadViewer } from './space-thread'

/**
 * Below a post: its reactions, then Comment and Copy link, then the thread
 * itself, so a member replies from the feed without leaving it.
 */
export function PostFoot({
  post,
  link,
  reactions,
  comments,
  commentCount,
  people,
  known,
  viewer,
  canComment,
  archived,
  consented,
  notice,
  now,
  titles,
  sessions,
  preview,
  limit,
  step,
}: {
  post: number
  /** The post's own page, absolute, for Copy link */
  link: string
  reactions: { counts: ReactionCounts; mine: ReactionKind[] }
  comments: TopComment[]
  commentCount: number
  people: PersonCard[]
  /** Everyone a comment may be by, members or not (the CILAS team, the reader) */
  known: PersonCard[]
  viewer: ThreadViewer
  canComment: boolean
  archived: boolean
  consented: boolean
  notice: NoticePart[]
  now: string
  titles: Record<string, string>
  /** The course sessions a comment may name with # */
  sessions?: SessionLinks | null
  /** In the feed: the newest comments first, and the thread only once there is one or the member asks */
  preview: boolean
  /** Passed to the thread: how many comments show first, and how many each "Show more" adds */
  limit?: number
  step?: number
}) {
  const t = useTranslations('SpacePost')
  const [focus, setFocus] = useState(0)
  useEffect(() => {
    const onComment = (e: Event) => {
      if ((e as CustomEvent<{ post: number }>).detail?.post === post) setFocus((n) => n + 1)
    }
    window.addEventListener(COMMENT_EVENT, onComment)
    return () => window.removeEventListener(COMMENT_EVENT, onComment)
  }, [post])
  const open = !preview || comments.length > 0 || focus > 0
  return (
    <>
      <footer className={styles.postFoot}>
        <FeedReactions
          post={post}
          counts={reactions.counts}
          mine={reactions.mine}
          disabled={archived}
        />
        <ExpandingButtonGroup
          label={t('postActions')}
          size="sm"
          defaultExpanded="comment"
          items={[
            {
              id: 'comment',
              label: commentCount > 0 ? t('comments', { count: commentCount }) : t('addComment'),
              icon: <MessageCircle />,
              disabled: !canComment && commentCount === 0,
              onSelect: () => setFocus((n) => n + 1),
            },
            {
              id: 'copy',
              label: t('copyLink'),
              doneLabel: t('copied'),
              icon: <Link2 />,
              onSelect: () => navigator.clipboard.writeText(link),
            },
          ]}
        />
      </footer>
      {open && (
        <SpaceThread
          post={post}
          comments={comments}
          people={people}
          known={known}
          viewer={viewer}
          canComment={canComment}
          consented={consented}
          notice={notice}
          now={now}
          titles={titles}
          sessions={sessions}
          preview={preview}
          limit={limit}
          step={step}
          focusKey={focus}
        />
      )}
    </>
  )
}
