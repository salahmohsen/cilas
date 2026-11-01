import { Suspense, type ReactNode } from 'react'

import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Skeleton } from '@/components/arc/skeleton/skeleton'

import styles from './dashboard.module.css'
import { WidgetCard } from './widget-card'

export type Span = 1 | 2 | 3 | 4

/** A widget that fails shows a quiet message and leaves the rest of the page alone. */
async function Guarded({ title, render }: { title: string; render: () => Promise<ReactNode> }) {
  try {
    return await render()
  } catch (error) {
    console.error(`Dashboard widget "${title}" failed`, error)
    return (
      <WidgetCard title={title}>
        <EmptyState title="Could not load" description="Reload the page to try again." />
      </WidgetCard>
    )
  }
}

/**
 * One cell of the dashboard grid. The widget loads on its own behind a
 * skeleton, so a slow query never holds the page.
 */
export function Slot({
  title,
  span = 1,
  render,
}: {
  title: string
  span?: Span
  render: () => Promise<ReactNode>
}) {
  return (
    <div className={styles.slot} data-span={span}>
      <Suspense
        fallback={
          <div className={styles.card}>
            <Skeleton label={`Loading ${title.toLowerCase()}`} lines={4} />
          </div>
        }
      >
        <Guarded title={title} render={render} />
      </Suspense>
    </div>
  )
}
