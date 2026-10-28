'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { AUTH_CHANGED } from '@/lib/auth-events'
import { clientEnv as env } from '@/env.client'

/**
 * Site search behind a full-screen panel, opened from the header button,
 * ⌘K / Ctrl + K or `/`. The panel, with InstantSearch and the Typesense
 * adapter, is its own chunk (site-search-panel.tsx): fetched when a reader
 * heads for the button or presses a shortcut, never on page load. Typesense
 * must be browser reachable with a search-only key; without
 * NEXT_PUBLIC_TYPESENSE_API_KEY the button hides entirely.
 */

const enabled = Boolean(env.NEXT_PUBLIC_TYPESENSE_API_KEY)

const load = () => import('@/components/site-search-panel')
const preload = () => void load()
const SearchPanel = dynamic(() => load().then((m) => m.SearchPanel), { ssr: false })

const noSubscription = () => () => {}

/**
 * Whether the visitor's keyboard has ⌘ (Apple), for the shortcut the button
 * shows. The server renders ⌘; other systems swap to Ctrl once hydrated.
 */
const useIsMac = () =>
  useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true,
  )

/** The search button and, while open, the panel. */
export function SiteSearch() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const t = useTranslations('Search')
  const mac = useIsMac()

  const close = useCallback(() => {
    setOpen(false)
    // Focus returns where the reader opened the panel from.
    requestAnimationFrame(() => trigger.current?.focus())
  }, [])

  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key === AUTH_CHANGED) close()
    }
    window.addEventListener(AUTH_CHANGED, close)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener(AUTH_CHANGED, close)
      window.removeEventListener('storage', storage)
    }
  }, [close])

  // ⌘K / Ctrl + K anywhere; `/` too, unless the reader is typing. Once
  // open, the panel's own `/` handler moves focus to its field instead.
  useEffect(() => {
    if (open) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const slash =
        event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing
      if (command || slash) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!enabled) return null

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t('openLabel')}
        aria-keyshortcuts={t('shortcut')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="site-control site-search-trigger"
        onClick={() => setOpen(true)}
        // Start fetching the panel as the reader heads for the button.
        onFocus={preload}
        onPointerEnter={preload}
      >
        <Search width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
        {/* From 1024px up: a field with its shortcut (src/app/(frontend)/styles.css). */}
        <span aria-hidden="true" className="site-search-label">
          {t('button')}
        </span>
        <span aria-hidden="true" className="site-search-keys" dir="ltr">
          {(mac ? ['⌘', 'K'] : ['Ctrl', 'K']).map((key) => (
            <kbd key={key}>{key}</kbd>
          ))}
        </span>
      </button>
      {/* Portalled: the header's own stacking context would otherwise let
          the page show through the panel. */}
      {open ? createPortal(<SearchPanel onClose={close} />, document.body) : null}
    </>
  )
}
