import { getTranslations } from 'next-intl/server'

import { Skeleton } from '@/components/arc/skeleton/skeleton'
import styles from '@/components/space/space.module.css'

export default async function Loading() {
  const t = await getTranslations('Spaces')
  return (
    <div className={styles.page}>
      <Skeleton lines={1} label={t('loading')} />
      <div className={styles.cards}>
        <Skeleton lines={3} label={t('loading')} />
        <Skeleton lines={3} label={t('loading')} />
      </div>
    </div>
  )
}
