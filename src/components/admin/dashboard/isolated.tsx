import { Suspense, type ReactNode } from 'react'

import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { Skeleton } from '@/components/arc/skeleton/skeleton'

import styles from './dashboard.module.css'
import { WidgetCard } from './widget-card'

/** A widget that fails shows a quiet message and leaves the rest of the page alone. */
export async function Guarded({
  title,
  render,
}: {
  title: string
  render: () => Promise<ReactNode>
}) {
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

/** A widget behind its own skeleton: a slow query holds back only itself. */
export function Isolated({ title, render }: { title: string; render: () => Promise<ReactNode> }) {
  return (
    <Suspense
      fallback={
        <div className={styles.card}>
          <Skeleton label={`Loading ${title.toLowerCase()}`} lines={4} />
        </div>
      }
    >
      <Guarded title={title} render={render} />
    </Suspense>
  )
}
