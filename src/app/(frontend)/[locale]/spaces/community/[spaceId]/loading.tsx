import { getTranslations } from 'next-intl/server'

import { Skeleton } from '@/components/arc/skeleton/skeleton'
import styles from '@/components/space/space.module.css'

/** The space page's own shape while it loads: header, composer line, three posts. */
export default async function Loading() {
  const t = await getTranslations('Spaces')
  return (
    <div className={`${styles.page} ${styles.wide}`}>
      <Skeleton lines={2} label={t('loading')} />
      <div className={styles.layout}>
        <div className={styles.feed}>
          <Skeleton avatar lines={1} label={t('loading')} />
          <Skeleton avatar lines={4} label={t('loading')} />
          <Skeleton avatar lines={3} label={t('loading')} />
          <Skeleton avatar lines={4} label={t('loading')} />
        </div>
        <div className={styles.rail}>
          <Skeleton lines={5} label={t('loading')} />
        </div>
      </div>
    </div>
  )
}
