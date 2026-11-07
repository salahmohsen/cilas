import {
  isNotificationKind,
  NOTIFICATION_KINDS,
  type NotificationKind,
} from '@/lib/notification-kinds'
import type { ClientNotificationEvent, StoredNotification } from '@/lib/realtime/events'
import { tabId } from '@/lib/realtime/stream-client'

/**
 * What the two bells (the site's and the admin's) share: the endpoint, the
 * calls on it and the reading of a row. A failed call gives null, never a throw.
 */
const API = '/api/notifications'

const call = (path: string, init?: RequestInit) =>
  fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  }).catch(() => null)

/** The newest notifications of the signed-in account, or null when the read failed. */
export const loadNotifications = async (limit: number): Promise<StoredNotification[] | null> => {
  const res = await call(`?limit=${limit}&depth=0&sort=-createdAt`)
  if (!res?.ok) return null
  return ((await res.json()) as { docs: StoredNotification[] }).docs
}

/** How many notifications are unread, or null when the read failed. */
export const countUnread = async (): Promise<number | null> => {
  const res = await call('?limit=0&depth=0&where[read_at][exists]=false')
  if (!res?.ok) return null
  return ((await res.json()) as { totalDocs: number }).totalDocs
}

export const markRead = (id: number | string, read: boolean) =>
  call(`/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ read_at: read ? new Date().toISOString() : null }),
  })

export const markAllRead = () => call('/read-all', { method: 'POST' })

export const dismiss = (id: number | string) => call(`/${id}`, { method: 'DELETE' })

/** Whether this tab's own request caused the change, so it shows no toast. */
export const isOwnTab = (event: ClientNotificationEvent) => event.origin === tabId()

/**
 * A row as the bells show it: a known kind carries the short name (`nameOf`
 * translates it on the site) and the row's description as the detail. A row
 * written before the registry keeps its old sentence as the detail line
 * instead of the title (`{`-prefixed titles are older still, with nothing to show).
 */
export const noteText = (
  note: Pick<StoredNotification, 'kind' | 'title' | 'description'>,
  nameOf: (kind: NotificationKind) => string = (kind) => NOTIFICATION_KINDS[kind].name,
): { label: string; detail: string | undefined } => {
  const known = isNotificationKind(note.kind)
  return {
    label: known ? nameOf(note.kind as NotificationKind) : note.title,
    detail:
      note.description ??
      (!known ||
      note.title === NOTIFICATION_KINDS[note.kind as NotificationKind].name ||
      note.title.startsWith('{')
        ? undefined
        : note.title),
  }
}
