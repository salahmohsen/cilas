'use client'

import { useSyncExternalStore } from 'react'

import { AUTH_CHANGED } from '@/lib/auth-events'

type SessionUser = {
  id: number
  email: string
  person?:
    | {
        id: number
        name?: string
        photo?:
          | { url?: string | null; sizes?: { thumbnail?: { url?: string | null } } }
          | number
          | null
      }
    | number
    | null
}

let user: SessionUser | null = null
let latest = 0
const listeners = new Set<() => void>()

// Depth 2 brings the person's photo; the callers that need less read the same answer.
const refresh = () => {
  const mine = ++latest
  fetch('/api/users/me?depth=2', { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: { user?: SessionUser | null } | null) => body?.user ?? null)
    .catch(() => null)
    .then((next) => {
      if (mine !== latest) return
      user = next
      listeners.forEach((listener) => listener())
    })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    refresh()
    window.addEventListener(AUTH_CHANGED, refresh)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size > 0) return
    window.removeEventListener(AUTH_CHANGED, refresh)
    latest++
    user = null
  }
}

/**
 * Who is signed in, or null. Pages are cached for everyone, so this asks the
 * server, once for all the components that use it, and again after a sign-in
 * or sign-out (AUTH_CHANGED).
 */
export const useSession = () =>
  useSyncExternalStore(
    subscribe,
    () => user,
    () => null,
  )
