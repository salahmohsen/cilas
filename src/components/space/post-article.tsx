import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import type { Payload } from 'payload'

import { personOf } from '@/access'
import type { Space, User } from '@/payload-types'
import { linkTitles, outsideLinks } from '@/lib/link-preview'
import { pageAddresses, threadTexts } from '@/lib/link-title'
import { absoluteUrl } from '@/lib/schema'
import { NOTICE } from '@/lib/space-consent'
import { mayComment, membership } from '@/lib/spaces'
import { memberState, postView, type PostView } from '@/lib/spaces-data'

import { Attachments } from './attachments'
import { commentsOpen, PostHead, type FeedContext } from './feed-row'
import { EventCard, eventDescription } from './event-card'
import { LinkPreviews } from './link-card'
import { PostPhotos } from './photo-grid'
import { PostBody } from './post-body'
import { sessionContextOf, sessionsFor } from './session-block'
import { PostDialog } from './post-dialog-link'
import { PostFoot } from './post-foot'
import { PostSession } from './post-session'
import { spacePeopleCards } from './space-people'
import styles from './space.module.css'
import { VotePoll } from './vote-poll'

/** In the post dialog: how many comments show first, and how many each "Show more" adds. */
const DIALOG_COMMENTS = { limit: 6, step: 10 }

/**
 * Everything a post's page or dialog needs, read through the reader's access.
 * Null when the reader may not read the post.
 */
export async function loadPost(
  payload: Payload,
  user: User,
  space: Space,
  postId: number,
  locale: string,
): Promise<{ view: PostView; context: FeedContext; consented: boolean; allowed: boolean } | null> {
  const mem = await membership(payload, user, space)
  if (mem.role === 'none') return null
  const [view, state, { cards, byId, moderators }] = await Promise.all([
    postView(payload, user, space, postId, locale === 'ar' ? 'ar' : 'en'),
    memberState(payload, user, space.id),
    spacePeopleCards(payload, user, space, locale),
  ])
  if (!view) return null
  const personId = personOf(user)
  const me = (personId != null && byId.get(personId)) || { name: user.email, photo: null }
  const allowed = mayComment(mem, space.posting ?? 'open')
  const titles = await linkTitles(pageAddresses(threadTexts([view.row.post.body], view.comments)))
  return {
    view,
    consented: state.consented,
    allowed,
    context: {
      archived: view.archived,
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
      titles,
      sessions: sessionContextOf(view.sessions),
    },
  }
}

/**
 * One post and its whole thread, as the post page and the post dialog show it.
 * In the dialog a post with photos puts them in a viewer in their own column,
 * which the stylesheet turns into the left side (the right in Arabic) on a
 * wide screen and a first row on a phone. On the page a photo opens the
 * dialog over it, at that photo.
 */
export async function PostArticle({
  view,
  context,
  href,
  dialog = false,
}: {
  view: PostView
  context: FeedContext
  /** The post's own route, for Copy link */
  href: string
  dialog?: boolean
}) {
  const t = await getTranslations('SpacePost')
  const { row, deleted, archived } = view
  const { post } = row
  const id = `post-${post.id}`
  const photos = dialog ? view.files.filter((f) => f.isImage) : []
  const files = dialog ? view.files.filter((f) => !f.isImage) : view.files
  const links = deleted ? [] : outsideLinks(post.body)
  const text = eventDescription(post)

  const article = (
    <article
      id={dialog ? undefined : id}
      className={dialog ? styles.dialogPost : styles.post}
      aria-labelledby={`${id}-author`}
      aria-describedby={deleted || text || post.kind === 'event' ? `${id}-body` : undefined}
    >
      <PostHead row={row} context={context} deleted={deleted} />
      {!deleted && post.kind === 'event' && (
        <EventCard
          post={post}
          rsvp={row.rsvp}
          context={context}
          href={href}
          headingLevel={dialog ? 3 : 2}
          descriptionId={`${id}-body`}
          fold={false}
        />
      )}
      {(deleted || text) && (
        <div id={`${id}-body`}>
          {deleted ? (
            <p className={styles.meta}>{t('deletedNotice')}</p>
          ) : (
            <PostBody
              body={text}
              people={context.people}
              titles={context.titles}
              sessions={sessionsFor(context.sessions, href)}
            />
          )}
        </div>
      )}
      {!deleted && row.session && (
        <PostSession session={row.session} kind={post.kind} postHref={href} />
      )}
      {!deleted && row.vote && (
        <VotePoll
          post={post.id}
          vote={row.vote}
          disabled={archived || !!post.locked}
          people={context.people}
        />
      )}
      {links.length > 0 && (
        <Suspense fallback={null}>
          <LinkPreviews urls={links} />
        </Suspense>
      )}
      {files.length > 0 && <Attachments files={files} label={t('files')} opensPost={!dialog} />}
      {!deleted && (
        <PostFoot
          post={post.id}
          link={absoluteUrl(href)}
          reactions={row.reactions}
          comments={view.comments}
          commentCount={row.commentCount}
          people={context.cards}
          viewer={context.viewer}
          canComment={commentsOpen(row, context, deleted)}
          archived={archived}
          consented={context.consented}
          notice={context.notice}
          now={context.now}
          titles={context.titles}
          sessions={sessionsFor(context.sessions, href).links}
          preview={false}
          {...(dialog ? { limit: DIALOG_COMMENTS.limit, step: DIALOG_COMMENTS.step } : {})}
        />
      )}
    </article>
  )
  if (!dialog)
    return (
      <PostDialog href={href} postId={post.id} photos={view.files.some((f) => f.isImage)} page>
        {article}
      </PostDialog>
    )
  if (!photos.length) return article
  return (
    <div className={styles.dialogSplit}>
      <div className={styles.dialogPhotos}>
        <PostPhotos photos={photos} />
      </div>
      {article}
    </div>
  )
}
