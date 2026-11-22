'use client'

import { useLocale, useTranslations } from 'next-intl'
import { createContext, Suspense, use, useContext, type ReactNode } from 'react'

import { unreadCount } from '@/lib/unread-count'
import type { NeedsCounts } from '@/portal/needs/needs'

import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'

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

/** The number as the nav writes it, in the page's digits; `null` for no number or 0. "9+" reads "more than 9" (`unreadCount`). */
const useCountWords = (key: PortalNavItem['key']) => {
  const t = useTranslations('Portal.nav')
  const locale = useLocale()
  const count = useNavCount(key)
  return count && count > 0
    ? unreadCount(count, locale, {
        some: (values) => t('count', values),
        many: (values) => t('countMany', values),
      })
    : null
}

function Spoken({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  return useCountWords(itemKey)?.spoken ?? null
}

function Chip({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  const words = useCountWords(itemKey)
  return (
    words && (
      <span className={styles.navCount} data-nav-count aria-hidden="true" dir="ltr">
        {words.shown}
      </span>
    )
  )
}

/**
 * The item's count in words, as text: ", 3 tasks". It goes right after the label's text inside one
 * visually hidden element that carries the link's name, so the name reads "Inbox, 3 tasks" with
 * no gap before the comma (a separate hidden element gets a space from the browser). Before the
 * counts settle, and for no number or 0, it renders nothing: the name is "Inbox".
 */
export function NavCountSpoken({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  return (
    <Suspense fallback={null}>
      <Spoken itemKey={itemKey} />
    </Suspense>
  )
}

/** The muted chip beside the item. Hidden from assistive tech: `NavCountSpoken` carries the number. */
export function NavCountChip({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  return (
    <Suspense fallback={null}>
      <Chip itemKey={itemKey} />
    </Suspense>
  )
}
