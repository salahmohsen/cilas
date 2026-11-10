import { Suspense, type ReactNode } from 'react'

import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Skeleton } from '@/components/arc/skeleton/skeleton'

import styles from './dashboard.module.css'
import { WidgetCard } from './widget-card'

/**
 * A widget that fails says so and leaves the rest of the page alone. `source`
 * names an outside service the data comes from, as PostHog; only its error
 * message is logged, which never holds the key.
 */
export async function Guarded({
  title,
  render,
  source,
}: {
  title: string
  render: () => Promise<ReactNode>
  source?: string
}) {
  try {
    return await render()
  } catch (error) {
    console.error(
      `Dashboard widget "${title}" failed`,
      source && error instanceof Error ? error.message : error,
    )
    return (
      <WidgetCard title={title}>
        <EmptyState
          title={source ? `Could not load from ${source}` : 'Could not load'}
          description="Reload the page to try again."
        />
      </WidgetCard>
    )
  }
}

/** A widget behind its own skeleton: a slow query holds back only itself. */
export function Isolated({
  title,
  render,
  source,
}: {
  title: string
  render: () => Promise<ReactNode>
  source?: string
}) {
  return (
    <Suspense
      fallback={
        <div className={styles.card}>
          <Skeleton label={`Loading ${title.toLowerCase()}`} lines={4} />
        </div>
      }
    >
      <Guarded title={title} render={render} source={source} />
    </Suspense>
  )
}
