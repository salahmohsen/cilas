import { useTranslations } from 'next-intl'
import { Suspense, type ReactNode } from 'react'

import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { SectionBoundary } from '@/portal/needs/section-boundary'
import styles from './home.module.css'

export function HomeCardSkeleton() {
  const t = useTranslations('Portal.home')
  return <Skeleton label={t('loading')} lines={2} className={styles.card} />
}

export function CardBoundary({ children }: { children: ReactNode }) {
  return (
    <div className={styles.card}>
      <SectionBoundary>
        <Suspense fallback={<HomeCardSkeleton />}>{children}</Suspense>
      </SectionBoundary>
    </div>
  )
}
