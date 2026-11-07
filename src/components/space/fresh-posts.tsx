'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/arc/button/button'
import { spaceNewPostsAction } from '@/lib/space-actions'

import styles from './space.module.css'

/**
 * Spec §Updates: every 30 seconds while the tab is visible, count new posts.
 * The feed never changes under the reader; the banner loads them on request.
 */
export function FreshPosts({ space, since }: { space: number; since: string }) {
  const t = useTranslations('Spaces')
  const router = useRouter()
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      setCount(await spaceNewPostsAction(space, since))
    }, 30_000)
    return () => clearInterval(timer)
  }, [space, since])
  return (
    <div role="status" className={styles.fresh}>
      {count > 0 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setCount(0)
            router.refresh()
          }}
        >
          {t('newPosts', { count })}
        </Button>
      )}
    </div>
  )
}
