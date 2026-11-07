'use client'

import { useEffect, useRef } from 'react'

const SAVE_DELAY_MS = 500

/** A draft saved by `useDraft`, for a form that needs it before it first renders. */
export function readDraft<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}

/**
 * Keeps a form's answers on this device while they are typed, so a closed tab
 * or a failed send loses nothing. The saved draft is passed to `onRestore`
 * once, when the form opens (a form that must have it before its first render
 * reads it with `readDraft` and leaves `onRestore` out); `draft` is what to keep as it changes (null: keep
 * nothing, and drop any saved draft). The browser's storage can be missing or refuse a write (private
 * windows, a full disk, blocked site data); a draft is only a convenience, so
 * every failure is ignored and the form works without it.
 */
export function useDraft<T>(
  key: string,
  {
    enabled,
    draft,
    onRestore,
  }: { enabled: boolean; draft: T | null; onRestore?: (saved: T) => void },
) {
  const restore = useRef(onRestore)
  restore.current = onRestore

  useEffect(() => {
    if (!enabled) return
    const saved = readDraft<T>(key)
    if (saved) restore.current?.(saved)
  }, [key, enabled])

  // As text, so the save waits for the answers to change, not for a new object.
  const kept = enabled && draft !== null ? JSON.stringify(draft) : null
  useEffect(() => {
    if (kept === null) {
      if (enabled) {
        try {
          localStorage.removeItem(key)
        } catch {}
      }
      return
    }
    const id = setTimeout(() => {
      try {
        localStorage.setItem(key, kept)
      } catch {}
    }, SAVE_DELAY_MS)
    return () => clearTimeout(id)
  }, [key, kept, enabled])

  return {
    clear: () => {
      try {
        localStorage.removeItem(key)
      } catch {}
    },
  }
}
