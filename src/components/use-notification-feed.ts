'use client'

import { useEffect, useRef } from 'react'

import type { ClientNotificationEvent } from '@/lib/realtime/events'
import { subscribeNotifications } from '@/lib/realtime/stream-client'

export function useNotificationFeed({
  load,
  onEvent,
  enabled = true,
  account,
}: {
  load: () => void | Promise<void>
  onEvent: (event: ClientNotificationEvent) => void
  enabled?: boolean
  account?: string | number
}) {
  const handlers = useRef({ load, onEvent })
  useEffect(() => {
    handlers.current = { load, onEvent }
  }, [load, onEvent])

  useEffect(() => {
    if (!enabled) return
    const first = setTimeout(() => void handlers.current.load(), 0)
    const unsubscribe = subscribeNotifications({
      event: (event) => handlers.current.onEvent(event),
      sync: () => void handlers.current.load(),
    })
    const back = () => document.visibilityState === 'visible' && void handlers.current.load()
    document.addEventListener('visibilitychange', back)
    return () => {
      clearTimeout(first)
      unsubscribe()
      document.removeEventListener('visibilitychange', back)
    }
  }, [enabled, account])
}
