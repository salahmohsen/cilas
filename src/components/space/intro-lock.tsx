'use client'

import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'

import { Button } from '@/components/arc/button/button'
import { EmptyState } from '@/components/arc/empty-state/empty-state'

/** Opens a post's comment box; the post's foot listens for its own id. */
export const COMMENT_EVENT = 'space:comment'

/**
 * Brings a post's comment box into view and puts the cursor in it: the lock
 * message and the checklist's "Introduce yourself" both lead here.
 */
export const openComments = (post: number) => {
  window.dispatchEvent(new CustomEvent(COMMENT_EVENT, { detail: { post } }))
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Two frames: the thread may mount only now, and the box with it.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const article = document.getElementById(`post-${post}`)
      const box = article?.querySelector('textarea, [contenteditable="true"]')
      ;(box ?? article)?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: box ? 'center' : 'start',
      })
    }),
  )
}

/** In place of the posts a member cannot read yet: why, and the way in. */
export function IntroLock({ post }: { post: number }) {
  const t = useTranslations('Spaces')
  return (
    <EmptyState
      icon={<Lock width={24} height={24} strokeWidth={1.5} />}
      title={t('introLockTitle')}
      description={t('introLockHint')}
      action={
        <Button variant="secondary" size="sm" onClick={() => openComments(post)}>
          {t('introLockAction')}
        </Button>
      }
    />
  )
}
