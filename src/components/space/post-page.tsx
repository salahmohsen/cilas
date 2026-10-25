import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { Alert } from '@/components/arc/alert/alert'
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb'
import type { Course, Programme, Space, User } from '@/payload-types'

import { loadPost, PostArticle } from './post-article'
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
  const [t, ts, loaded] = await Promise.all([
    getTranslations('SpacePost'),
    getTranslations('Spaces'),
    loadPost(payload, user, space, postId, locale),
  ])
  if (!loaded) notFound()

  const { view, context, allowed } = loaded
  const { row, deleted, archived } = view
  const { post } = row
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
      <main className={styles.column} aria-labelledby={`post-${post.id}-author`}>
        <PostArticle view={view} context={context} href={href} />
        {why && <Alert tone="info" title={why} />}
      </main>
    </div>
  )
}
