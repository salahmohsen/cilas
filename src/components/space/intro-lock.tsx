'use client'

import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'

import { Button } from '@/components/arc/button/button'

import styles from './space.module.css'

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

/** Up to three ghost posts: enough to read as a feed, never a measure of how many there are. */
const GHOSTS = 3

/**
 * Under the intro post, in place of the posts a member cannot read yet: a
 * stack of blurred post shapes says there is more here, and the card on it
 * says how many, why, and the way in. The shapes are drawn, never the posts
 * themselves, so nothing hidden reaches the page.
 */
export function IntroLock({ post, hidden }: { post: number; hidden: number }) {
  const t = useTranslations('Spaces')
  return (
    <section className={styles.lock} aria-labelledby={`lock-${post}`}>
      <div className={styles.lockGhosts} aria-hidden="true">
        {Array.from({ length: GHOSTS }, (_, i) => (
          <div key={i} className={styles.lockGhost}>
            <span className={styles.lockFace} />
            <span className={styles.lockLines}>
              <span style={{ width: '38%' }} />
              <span style={{ width: i === 1 ? '72%' : '88%' }} />
              <span style={{ width: i === 2 ? '46%' : '64%' }} />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.lockCard}>
        <span className={styles.lockIcon} aria-hidden="true">
          <Lock size={20} strokeWidth={1.75} />
        </span>
        <h2 id={`lock-${post}`} className={styles.lockTitle}>
          {hidden > 0 ? t('introLockCount', { count: hidden }) : t('introLockTitle')}
        </h2>
        <p className={styles.lockText}>{t('introLockHint')}</p>
        <Button variant="primary" size="sm" onClick={() => openComments(post)}>
          {t('introLockAction')}
        </Button>
      </div>
    </section>
  )
}
