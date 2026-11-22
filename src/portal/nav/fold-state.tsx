'use client'

import { useTranslations } from 'next-intl'
import { createContext, use, useEffect, useEffectEvent, useState } from 'react'

import { announce } from '@/portal/feedback/announce'

import { WIDE } from './breakpoint'
import { writeFold } from './fold'
import { isFoldKey, overlayOpen } from './fold-key'
import { readShortcutOn, writeShortcutOn } from './shortcut-storage'

type Fold = {
  folded: boolean
  toggle: () => void
  shortcutOn: boolean
  setShortcutOn: (on: boolean) => void
}

const FoldContext = createContext<Fold | null>(null)

/** The fold state of the portal shell. Only a component inside `FoldProvider` may call it. */
export const useFold = (): Fold => {
  const fold = use(FoldContext)
  if (!fold) throw new Error('useFold needs a FoldProvider above it')
  return fold
}

/** `window.localStorage` itself can throw (blocked site data): then there is no storage. */
const storageOf = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Owns whether the sidebar is folded (the server reads the cookie, so the
 * first paint is right) and the `[` key, which folds from anywhere on the
 * page that is not a text field, menu or dialog. Only the key announces:
 * a click changes `aria-expanded`, which a screen reader already reads.
 */
export function FoldProvider({
  folded: foldedAtLoad,
  accountId,
  children,
}: {
  folded: boolean
  accountId: number
  children: React.ReactNode
}) {
  const t = useTranslations('Portal')
  const [folded, setFolded] = useState(foldedAtLoad)
  const [shortcutOn, setShortcut] = useState(true)
  const toggle = () => {
    writeFold(accountId, !folded)
    setFolded(!folded)
  }
  const setShortcutOn = (on: boolean) => {
    const storage = storageOf()
    if (storage) writeShortcutOn(storage, accountId, on)
    setShortcut(on)
  }
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const context = {
      overlayOpen: () => overlayOpen(document),
      wide: matchMedia(WIDE).matches,
      shortcutOn,
    }
    if (!isFoldKey(event, context)) return
    event.preventDefault()
    toggle()
    announce(t(folded ? 'fold.unfolded' : 'fold.folded'))
  })

  useEffect(() => {
    const storage = storageOf()
    if (storage) setShortcut(readShortcutOn(storage, accountId))
  }, [accountId])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [])

  return <FoldContext value={{ folded, toggle, shortcutOn, setShortcutOn }}>{children}</FoldContext>
}
