'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { isNotificationKind, type NotificationKind } from '@/lib/notification-kinds'
import type { ClientNotificationEvent } from '@/lib/realtime/events'
import { subscribeNotifications } from '@/lib/realtime/stream-client'

/**
 * Whether a new notification of this kind means the reader's work changed. A new kind is a type
 * error until it says so here. `withdrawn` joins with the withdraw move (phase 2).
 */
export const REFRESHES_WORK: Record<NotificationKind, boolean> = {
  submitted: true,
  approved: true,
  changes_requested: true,
  rejected: true,
  removed: true,
  application: true,
  mention: false,
  comment: false,
  reply: false,
  reaction: false,
  announcement: false,
  moderation: false,
  report: false,
  event_changed: false,
  joined: false,
}

/**
 * Only a created row can change work: a read mark (`updated`) and a dismissal (`deleted`) cannot.
 * A row with no `doc` (too big for one database message) has an unknown kind, so it refreshes.
 */
export const refreshes = (event: ClientNotificationEvent): boolean =>
  event.op === 'created' &&
  (!event.doc || (isNotificationKind(event.doc.kind) && REFRESHES_WORK[event.doc.kind]))

const QUIET_MS = 1_000

/**
 * Runs `router.refresh()` once the stream has been quiet for a second after a work event, or after
 * a reconnect (events in the gap are lost). The server components re-render, so the sidebar numbers
 * and the Inbox rows follow with no reload; client state stays.
 */
export function WorkRefresh(): null {
  const router = useRouter()
  const refresh = useRef(router.refresh)
  useEffect(() => {
    refresh.current = router.refresh
  }, [router])
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const queue = () => {
      clearTimeout(timer)
      timer = setTimeout(() => refresh.current(), QUIET_MS)
    }
    const unsubscribe = subscribeNotifications({
      event: (event) => {
        if (refreshes(event)) queue()
      },
      sync: queue,
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [])
  return null
}
