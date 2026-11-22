'use client'

import { createContext, use, useContext, type ReactNode } from 'react'

import type { NeedsCounts } from '@/portal/needs/needs'

import type { PortalNavItem } from './portal-nav'

/**
 * The number each nav item shows, from the reader's counts: the one table. An
 * item with no row has no number. A later item with a count adds one row.
 */
export const COUNT_OF: Partial<
  Record<PortalNavItem['key'], (counts: NeedsCounts) => number | null>
> = {
  inbox: (counts) => counts.total,
  articles: (counts) => counts.by.ownArticles ?? null,
  courses: (counts) => counts.by.ownCourses ?? null,
}

/** The layout's counts promise, or `null` when it failed. The layout never awaits it, so the shell streams first. */
const NavCountsContext = createContext<Promise<NeedsCounts | null> | null>(null)

export function NavCountsProvider({
  counts,
  children,
}: {
  counts: Promise<NeedsCounts | null>
  children: ReactNode
}) {
  return <NavCountsContext value={counts}>{children}</NavCountsContext>
}

/** The item's number, or `null` for no number: no row, no provider, a failed count. Suspends until the counts arrive. */
export const useNavCount = (key: PortalNavItem['key']): number | null => {
  const promise = useContext(NavCountsContext)
  const counts = promise ? use(promise) : null
  return counts ? (COUNT_OF[key]?.(counts) ?? null) : null
}
