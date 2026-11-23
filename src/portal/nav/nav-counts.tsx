'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter, useSelectedLayoutSegment } from 'next/navigation'
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from 'react'

import { unreadCount } from '@/lib/unread-count'
import type { NeedsCounts } from '@/portal/needs/needs'
import { subscribeWorkRefresh } from '@/portal/needs/work-refresh'

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

const NavCountsContext = createContext<NeedsCounts | null>(null)

export function NavCountsProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<NeedsCounts | null>(null)
  const router = useRouter()
  const segment = useSelectedLayoutSegment()
  const refreshInbox = useEffectEvent(() => {
    if (segment === 'inbox') router.refresh()
  })

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    let loading = false
    let pendingWork = false

    const load = async () => {
      if (loading || signal.aborted) return
      loading = true
      try {
        const response = await fetch('/api/portal/counts', { signal, priority: 'low' })
        const next = response.ok ? ((await response.json()) as NeedsCounts) : null
        if (!signal.aborted) setCounts(next)
      } catch {
        if (!signal.aborted) setCounts(null)
      } finally {
        loading = false
        // A work event during a fetch may be newer than the response. Take one trailing read.
        if (pendingWork) {
          pendingWork = false
          void load()
        }
      }
    }

    void load()
    const unsubscribe = subscribeWorkRefresh(() => {
      if (loading) pendingWork = true
      else void load()
      refreshInbox()
    })
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => {
      controller.abort()
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return <NavCountsContext value={counts}>{children}</NavCountsContext>
}

/** The item's number, or null while loading, after failure, or when the item has no count. */
export const useNavCount = (key: PortalNavItem['key']): number | null => {
  const counts = useContext(NavCountsContext)
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

/**
 * The count text follows the label in the same visually hidden element. This keeps the
 * accessible name "Inbox, 3 tasks"; while empty, the only spoken text is "Inbox".
 */
export function NavCountSpoken({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  return useCountWords(itemKey)?.spoken ?? null
}

/** Reserve the chip's space before the fetch, with no additional accessible text. */
export function NavCountChip({ itemKey }: { itemKey: PortalNavItem['key'] }) {
  const words = useCountWords(itemKey)
  if (!COUNT_OF[itemKey]) return null
  return (
    <span
      className={styles.navCount}
      data-nav-count={words ? '' : undefined}
      aria-hidden="true"
      dir="ltr"
    >
      {words?.shown}
    </span>
  )
}
