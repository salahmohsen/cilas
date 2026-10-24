import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { personOf } from '@/access'
import { Alert } from '@/components/arc/alert/alert'
import { CopyButton } from '@/components/arc/copy-button/copy-button'
import { PageHeader } from '@/components/arc/page-header/page-header'
import type { Course, Programme, Space, User } from '@/payload-types'
import { absoluteUrl } from '@/lib/schema'
import { NOTICE } from '@/lib/space-consent'
import { mayComment, membership } from '@/lib/spaces'
import { memberState, moderatorPeople, postView } from '@/lib/spaces-data'
import { spaceRoster } from '@/lib/spaces-write'

import { CommentThread, FileChip } from './comment-thread-space'
import { FeedReactions } from './feed-reactions'
import { PostHead, type Person } from './feed-row'
import { PostBody } from './post-body'
import styles from './space.module.css'

/**
 * Spec §4: one post and its whole thread. Both post routes render it. A
 * member who may not comment (posting level, lock, archive) still reads.
 */
export async function PostPage({
  locale,
  user,
  landing,
  postId,
  spacePath,
}: {
  locale: string
  user: User
  landing: { space: Space; course?: Course; programme?: Programme }
  postId: number
  /** The space page's route; the post's own route is under it */
  spacePath: string
}) {
  const { space } = landing
  const payload = await getPayload({ config })
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') notFound()

  const [t, ts, view, state, roster, moderators] = await Promise.all([
    getTranslations('SpacePost'),
    getTranslations('Spaces'),
    postView(payload, user, space, postId),
    memberState(payload, user, space.id),
    spaceRoster({ payload, user, space: space.id }),
    moderatorPeople(payload, space),
  ])
  if (!view) notFound()

  const { row, deleted, archived } = view
  const { post } = row
  const viewer = { personId: personOf(user), moderator: mem.role === 'moderator' }
  const people = new Map<number, Person>(
    (roster.ok ? roster.data.members : []).map((m) => [
      m.personId,
      { name: m.name, photo: m.photo?.url ?? null },
    ]),
  )
  const allowed = mayComment(mem, space.posting ?? 'open')
  const canComment = allowed && !archived && !deleted && !post.locked
  const why = archived
    ? ts('archivedWhy')
    : deleted
      ? null
      : post.locked
        ? t('lockedNotice')
        : !allowed
          ? t('commentsModeratorsOnly')
          : null

  const spaceTitle =
    landing.course?.title ??
    landing.programme?.title ??
    (space.kind === 'community' ? ts('community') : ts(space.kind))
  const href = `${spacePath}/posts/${post.id}`
  const id = `post-${post.id}`

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <PageHeader
        breadcrumb={[
          { label: ts('title'), href: `/${locale}/spaces` },
          { label: spaceTitle, href: spacePath },
          { label: t('postLabel') },
        ]}
        title={spaceTitle}
      />
      <main className={styles.column} aria-labelledby={`${id}-author`}>
        <article
          id={id}
          className={styles.post}
          aria-labelledby={`${id}-author`}
          aria-describedby={`${id}-body`}
        >
          <PostHead
            row={row}
            archived={archived}
            viewer={viewer}
            moderators={moderators}
            people={people}
            deleted={deleted}
          />
          <div id={`${id}-body`}>
            {deleted ? (
              <p className={styles.meta}>{t('deletedNotice')}</p>
            ) : (
              <PostBody body={post.body} />
            )}
          </div>
          {view.files.length > 0 && (
            <div className={styles.files} aria-label={t('files')} role="group">
              {view.files.map((f) => (
                <FileChip key={f.id} file={f} />
              ))}
            </div>
          )}
          {!deleted && (
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
              <CopyButton
                value={absoluteUrl(href)}
                label={t('copyLink')}
                iconOnly
                variant="plain"
              />
            </footer>
          )}
        </article>
        {why && <Alert tone="info" title={why} />}
        <CommentThread
          post={post.id}
          comments={view.comments}
          viewer={viewer}
          moderators={moderators}
          people={people}
          canComment={canComment}
          consented={state.consented}
          notice={NOTICE[locale === 'ar' ? 'ar' : 'en']}
        />
      </main>
    </div>
  )
}
