/**
 * The live notification event: what one change to a `notifications` row sends
 * from the database to the recipient's open tabs (docs/realtime-notifications.md).
 * Shared by the server (publish, hub, stream route) and the browser.
 */

export type StoredNotification = {
  id: number
  kind: string
  title: string
  description?: string | null
  link?: string | null
  read_at?: string | null
  actor_name?: string | null
  actor_photo?: string | null
  createdAt: string
}

export type NotificationEvent = {
  op: 'created' | 'updated' | 'deleted'
  id: number
  /** The account whose tabs get the event. The stream drops it before sending. */
  recipient: number
  /** The tab whose request caused the change, so that tab shows no toast. */
  origin?: string
  /** The row after the change. Absent on delete, and when too big for one NOTIFY. */
  doc?: StoredNotification
}

export type ClientNotificationEvent = Omit<NotificationEvent, 'recipient'>

export const NOTIFICATION_CHANNEL = 'cilas_notifications'

export const TAB_HEADER = 'x-cilas-tab'
