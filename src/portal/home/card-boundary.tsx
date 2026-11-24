import { Suspense, type ReactNode } from 'react'

import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { SectionBoundary } from '@/portal/needs/section-boundary'
import styles from './home.module.css'

/** Decorative: the page announces "Loading Home" once (`HomeLoading`), not once per card. It wears the loaded card's frame, so the card does not jump when it arrives. */
export function HomeCardSkeleton() {
  return (
    <div className={styles.frame} aria-hidden="true">
      <Skeleton lines={2} />
    </div>
  )
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
