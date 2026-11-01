'use client'

import { useEffect } from 'react'

import { AUTH_CHANGED } from '@/lib/auth-events'
import { registerServiceWorker } from '@/lib/push/client'

/**
 * Registers the service worker once someone is signed in, and not before:
 * a visitor gets no worker. The page is cached for everyone, so it asks who
 * is signed in, as the header does, and asks again after a sign-in. Renders
 * nothing. Mounted only when push is set up on the server.
 */
export function PushRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let done = false
    const check = () => {
      if (done) return
      fetch('/api/users/me', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { user?: { id: number } | null } | null) => {
          if (!body?.user || done) return
          done = true
          return registerServiceWorker()
        })
        .catch(() => {})
    }
    check()
    window.addEventListener(AUTH_CHANGED, check)
    return () => window.removeEventListener(AUTH_CHANGED, check)
  }, [])
  return null
}
