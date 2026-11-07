/**
 * Every kind of notification, in one record: the short name the bells show,
 * the tone, the glyph's key, and who may switch it on or off in the settings
 * (`audience`; null for a kind that is not a preference). The type, the
 * collection's options, the preferences and both bells derive from it. Keep
 * the order: it is the order of the collection's stored values.
 */
export const NOTIFICATION_KINDS = {
  submitted: { name: 'Review requested', tone: 'info', icon: 'file-search', audience: 'admins' },
  approved: { name: 'Approved', tone: 'success', icon: 'circle-check', audience: 'all' },
  changes_requested: {
    name: 'Changes requested',
    tone: 'warning',
    icon: 'pen-line',
    audience: 'all',
  },
  rejected: { name: 'Rejected', tone: 'warning', icon: 'circle-x', audience: 'all' },
  removed: { name: 'Removed', tone: 'info', icon: 'trash', audience: 'all' },
  application: { name: 'New application', tone: 'info', icon: 'user-plus', audience: 'admins' },
  mention: { name: 'Mentioned you', tone: 'info', icon: 'at-sign', audience: 'all' },
  comment: { name: 'New comment', tone: 'info', icon: 'message-circle', audience: 'all' },
  reply: { name: 'New reply', tone: 'info', icon: 'reply', audience: 'all' },
  reaction: { name: 'New reaction', tone: 'info', icon: 'heart', audience: 'all' },
  announcement: { name: 'New announcement', tone: 'info', icon: 'megaphone', audience: 'all' },
  moderation: { name: 'Moderation issue', tone: 'warning', icon: 'shield', audience: null },
  report: { name: 'New report', tone: 'warning', icon: 'flag', audience: null },
  event_changed: {
    name: 'Event changed',
    tone: 'info',
    icon: 'calendar-clock',
    audience: 'all',
  },
} as const satisfies Record<
  string,
  {
    name: string
    tone: 'info' | 'success' | 'warning'
    icon: string
    audience: 'all' | 'admins' | null
  }
>

export type NotificationKind = keyof typeof NOTIFICATION_KINDS
export type NotificationIcon = (typeof NOTIFICATION_KINDS)[NotificationKind]['icon']
export type PreferenceKind = {
  [K in NotificationKind]: (typeof NOTIFICATION_KINDS)[K]['audience'] extends null ? never : K
}[NotificationKind]

export const NOTIFICATION_KIND_NAMES = Object.keys(NOTIFICATION_KINDS) as NotificationKind[]

export const isNotificationKind = (kind: unknown): kind is NotificationKind =>
  typeof kind === 'string' && Object.hasOwn(NOTIFICATION_KINDS, kind)
