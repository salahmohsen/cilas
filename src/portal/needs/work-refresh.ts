import { isNotificationKind, type NotificationKind } from '@/lib/notification-kinds'
import type { ClientNotificationEvent } from '@/lib/realtime/events'
import { subscribeNotifications } from '@/lib/realtime/stream-client'

/**
 * Whether a new notification of this kind means the reader's work changed. A new kind is a type
 * error until it says so here.
 */
export const REFRESHES_WORK: Record<NotificationKind, boolean> = {
  submitted: true,
  withdrawn: true,
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

/** Coalesces work events and stream reconnects using the existing quiet period. */
export function subscribeWorkRefresh(refresh: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const queue = () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, QUIET_MS)
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
}
