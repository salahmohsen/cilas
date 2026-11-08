'use client'

import { Children, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * The keys in the order already on screen. Keys that left go; a key not seen
 * before takes its place in the new order, so a new post leads and more posts
 * follow at the end.
 */
export const keepOrder = (shown: string[], next: string[]): string[] => {
  const present = new Set(next)
  const seen = new Set(shown)
  const result = shown.filter((key) => present.has(key))
  next.forEach((key, index) => {
    if (!seen.has(key)) result.splice(Math.min(index, result.length), 0, key)
  })
  return result
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((k, i) => k === b[i])

/**
 * Keeps keyed children where the reader saw them while the page refreshes: a
 * comment moves its post up the feed, and that must not happen under the
 * reader's eyes. The new order shows on the next visit, or when `scope` changes.
 */
export function StableOrder({ scope, children }: { scope: string; children: ReactNode }) {
  const items = Children.toArray(children) as (ReactNode & { key: string })[]
  const keys = items.map((item) => item.key)
  const [state, setState] = useState({ scope, order: keys })
  const order = state.scope === scope ? keepOrder(state.order, keys) : keys
  if (state.scope !== scope || !same(order, state.order)) setState({ scope, order })
  const byKey = new Map(items.map((item) => [item.key, item]))
  return <>{order.map((key) => byKey.get(key))}</>
}
