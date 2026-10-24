import config from '@payload-config'
import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { personOf } from '@/access'
import { Alert } from '@/components/arc/alert/alert'
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb'
import type { Course, Programme, Space, User } from '@/payload-types'
import { firstLink } from '@/lib/link-preview'
import { absoluteUrl } from '@/lib/schema'
import { NOTICE } from '@/lib/space-consent'
import { mayComment, membership } from '@/lib/spaces'
import { memberState, postView } from '@/lib/spaces-data'

import { commentsOpen, FileChip, PostHead, type FeedContext } from './feed-row'
import { EventDetails } from './event-details'
import { LinkCard } from './link-card'
import { PostBody } from './post-body'
import { PostFoot } from './post-foot'
import { spacePeopleCards } from './space-people'
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

  const [t, ts, view, state, { cards, byId, moderators }] = await Promise.all([
    getTranslations('SpacePost'),
    getTranslations('Spaces'),
    postView(payload, user, space, postId),
    memberState(payload, user, space.id),
    spacePeopleCards(payload, user, space, locale),
  ])
  if (!view) notFound()

  const { row, deleted, archived } = view
  const { post } = row
  const personId = personOf(user)
  const me = (personId != null && byId.get(personId)) || { name: user.email, photo: null }
  const allowed = mayComment(mem, space.posting ?? 'open')
  const context: FeedContext = {
    archived,
    viewer: {
      personId,
      moderator: mem.role === 'moderator',
      me: { name: me.name, photo: me.photo },
    },
    moderators,
    people: byId,
    cards,
    mayComment: allowed,
    consented: state.consented,
    notice: NOTICE[locale === 'ar' ? 'ar' : 'en'],
    now: new Date().toISOString(),
  }
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
      <header className={styles.spaceHead}>
        <Breadcrumb
          items={[
            { label: ts('title'), href: `/${locale}/spaces` },
            { label: spaceTitle, href: spacePath },
            { label: t('postLabel') },
          ]}
        />
      </header>
      <main className={styles.column} aria-labelledby={`${id}-author`}>
        <article
          id={id}
          className={styles.post}
          aria-labelledby={`${id}-author`}
          aria-describedby={`${id}-body`}
        >
          <PostHead row={row} context={context} deleted={deleted} />
          <div id={`${id}-body`}>
            {deleted ? (
              <p className={styles.meta}>{t('deletedNotice')}</p>
            ) : (
              <PostBody body={post.body} people={byId} />
            )}
          </div>
          {!deleted && post.kind === 'event' && post.event_starts_at && (
            <EventDetails startsAt={post.event_starts_at} location={post.event_location ?? ''} />
          )}
          {!deleted && firstLink(post.body) && (
            <Suspense fallback={null}>
              <LinkCard url={firstLink(post.body)!} />
            </Suspense>
          )}
          {view.files.length > 0 && (
            <div className={styles.files} aria-label={t('files')} role="group">
              {view.files.map((f) => (
                <FileChip key={f.id} file={f} />
              ))}
            </div>
          )}
          {!deleted && (
            <PostFoot
              post={post.id}
              link={absoluteUrl(href)}
              reactions={row.reactions}
              comments={view.comments}
              commentCount={row.commentCount}
              people={cards}
              viewer={context.viewer}
              canComment={commentsOpen(row, context, deleted)}
              archived={archived}
              consented={state.consented}
              notice={context.notice}
              now={context.now}
              preview={false}
            />
          )}
        </article>
        {why && <Alert tone="info" title={why} />}
      </main>
    </div>
  )
}
