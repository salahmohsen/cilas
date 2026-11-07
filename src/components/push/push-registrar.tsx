'use client'

import { useEffect } from 'react'

import { useSession } from '@/components/use-session'
import { registerServiceWorker } from '@/lib/push/client'

/**
 * Registers the service worker once someone is signed in, and not before:
 * a visitor gets no worker. The page is cached for everyone, so it reads who
 * is signed in from useSession, which asks again after a sign-in. Renders
 * nothing. Mounted only when push is set up on the server.
 */
export function PushRegistrar() {
  const signedIn = useSession() !== null
  useEffect(() => {
    if (!signedIn || !('serviceWorker' in navigator)) return
    registerServiceWorker().catch(() => {})
  }, [signedIn])
  return null
}
