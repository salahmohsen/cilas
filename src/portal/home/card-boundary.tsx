import { Suspense, type ReactNode } from 'react'

import type { AdminView } from '@/access'
import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { SectionBoundary } from '@/portal/needs/section-boundary'
import styles from './home.module.css'

/** The four places of the board, in reading order. */
export const HOME_SLOTS = ['needs', 'next', 'spaces', 'latest'] as const

export type HomeSlot = (typeof HOME_SLOTS)[number]

const SKELETON_LINES: Record<HomeSlot, number> = { needs: 4, next: 3, spaces: 3, latest: 5 }

/** Decorative: the page announces "Loading Home" once (`HomeLoading`), not once per card. It holds the height its card needs, so what is below moves less when the card arrives. */
export function HomeCardSkeleton({ slot }: { slot: HomeSlot }) {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <Skeleton lines={SKELETON_LINES[slot]} />
    </div>
  )
}

/**
 * The board: one column, and twelve columns when the page frame is wider than
 * 900px. `view` sizes the Needs you placeholder: an admin's card is the tall one.
 */
export function HomeBoard({ view, children }: { view?: AdminView | null; children: ReactNode }) {
  return (
    <div className={styles.board} data-view={view ?? undefined}>
      <div className={styles.bento}>{children}</div>
    </div>
  )
}

export function HomeSlotBox({ slot, children }: { slot: HomeSlot; children: ReactNode }) {
  return (
    <div className={styles.slot} data-slot={slot}>
      {children}
    </div>
  )
}

export function CardBoundary({ slot, children }: { slot: HomeSlot; children: ReactNode }) {
  return (
    <HomeSlotBox slot={slot}>
      <SectionBoundary>
        <Suspense fallback={<HomeCardSkeleton slot={slot} />}>{children}</Suspense>
      </SectionBoundary>
    </HomeSlotBox>
  )
}
