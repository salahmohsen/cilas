'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

/** The search button and, while open, the panel. */
export function SiteSearch() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const t = useTranslations('Search')

  const close = useCallback(() => {
    setOpen(false)
    // Focus returns where the reader opened the panel from.
    requestAnimationFrame(() => trigger.current?.focus())
  }, [])

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
        className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-(--surface-muted)"
        onClick={() => setOpen(true)}
        // Start fetching the panel as the reader heads for the button.
        onFocus={preload}
        onPointerEnter={preload}
      >
        <Search width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {/* Portalled: the header's own stacking context would otherwise let
          the page show through the panel. */}
      {open ? createPortal(<SearchPanel onClose={close} />, document.body) : null}
    </>
  )
}
