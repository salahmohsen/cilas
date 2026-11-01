import { Suspense, type ReactNode } from 'react'

import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Skeleton } from '@/components/arc/skeleton/skeleton'

import styles from './dashboard.module.css'
import { WidgetCard } from './widget-card'

/** A widget that fails shows a quiet message and leaves the rest of the page alone. */
export async function Guarded({
  title,
  render,
  quiet = false,
}: {
  title: string
  render: () => Promise<ReactNode>
  /** On a failure show nothing, not a message: for a source that may be off or slow (analytics). */
  quiet?: boolean
}) {
  try {
    return await render()
  } catch (error) {
    console.error(
      `Dashboard widget "${title}" failed`,
      quiet && error instanceof Error ? error.message : error,
    )
    if (quiet) return null
    return (
      <WidgetCard title={title}>
        <EmptyState title="Could not load" description="Reload the page to try again." />
      </WidgetCard>
    )
  }
}

/** A widget behind its own skeleton: a slow query holds back only itself. */
export function Isolated({
  title,
  render,
  quiet = false,
}: {
  title: string
  render: () => Promise<ReactNode>
  quiet?: boolean
}) {
  return (
    <Suspense
      fallback={
        <div className={styles.card}>
          <Skeleton label={`Loading ${title.toLowerCase()}`} lines={4} />
        </div>
      }
    >
      <Guarded title={title} render={render} quiet={quiet} />
    </Suspense>
  )
}
