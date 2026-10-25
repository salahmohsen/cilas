'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatDistanceToNow, isYesterday } from 'date-fns'
import {
  AtSign,
  CalendarClock,
  CircleCheck,
  CircleX,
  FileSearch,
  Flag,
  Megaphone,
  MessageCircle,
  PenLine,
  Reply,
  Shield,
  Trash2,
  UserPlus,
} from 'lucide-react'

import {
  NotificationCenter,
  type NotificationItem,
} from '@/components/arc/notification-center/notification-center'
import { localDigits } from '@/lib/digits'
import { EVENT_NAMES, type NotificationKind } from '@/lib/notify'

type Stored = {
  id: number
  kind: NotificationKind
  title: string
  description?: string | null
  link?: string | null
  read_at?: string | null
  actor_name?: string | null
  actor_photo?: string | null
  createdAt: string
}

const API = '/api/notifications'
const TONES: Record<NotificationKind, NotificationItem['tone']> = {
  submitted: 'info',
  application: 'info',
  approved: 'success',
  changes_requested: 'warning',
  rejected: 'warning',
  removed: 'info',
  mention: 'info',
  comment: 'info',
  reply: 'info',
  announcement: 'info',
  moderation: 'warning',
  report: 'warning',
  event_changed: 'info',
}

/** The glyph each event kind shows when no actor portrait exists. */
const ICONS: Record<NotificationKind, ReactNode> = {
  submitted: <FileSearch size={18} strokeWidth={1.7} />,
  approved: <CircleCheck size={18} strokeWidth={1.7} />,
  changes_requested: <PenLine size={18} strokeWidth={1.7} />,
  rejected: <CircleX size={18} strokeWidth={1.7} />,
  removed: <Trash2 size={18} strokeWidth={1.7} />,
  application: <UserPlus size={18} strokeWidth={1.7} />,
  mention: <AtSign size={18} strokeWidth={1.7} />,
  comment: <MessageCircle size={18} strokeWidth={1.7} />,
  reply: <Reply size={18} strokeWidth={1.7} />,
  announcement: <Megaphone size={18} strokeWidth={1.7} />,
  moderation: <Shield size={18} strokeWidth={1.7} />,
  report: <Flag size={18} strokeWidth={1.7} />,
  event_changed: <CalendarClock size={18} strokeWidth={1.7} />,
}

const call = (path: string, init?: RequestInit) =>
  fetch(`${API}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  }).catch(() => null)

const relativeTime = (date: Date) => {
  if (isYesterday(date)) return 'Yesterday'

  return formatDistanceToNow(date, { addSuffix: false })
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd')
    .replace('about ', '')
    .replace('less than a minute', 'now')
}

/**
 * The signed-in account's notifications on the site (Arc's notification
 * center), the same ones as the admin's bell (src/collections/Notifications.ts):
 * marking one read here marks it there. It looks again every minute and when
 * the tab comes back into view.
 */
export function SiteNotifications() {
  const t = useTranslations('Notifications')
  const locale = useLocale()
  const [items, setItems] = useState<NotificationItem[] | null>(null)

  const load = useCallback(async () => {
    const res = await call('?limit=20&depth=0&sort=-createdAt')
    if (!res?.ok) return
    const { docs } = (await res.json()) as { docs: Stored[] }
    setItems(
      docs.map((n) => {
        // The kind carries the short label; rows written before the registry
        // keep their old sentence as the detail line instead of the title.
        const known = n.kind in EVENT_NAMES
        const label = known ? t(`kinds.${n.kind}`) : n.title
        const detail =
          n.description ??
          (!known || n.title === EVENT_NAMES[n.kind] || n.title.startsWith('{')
            ? undefined
            : n.title)
        return {
          id: String(n.id),
          title: label,
          description: detail,
          actor:
            n.actor_name || n.actor_photo
              ? { name: n.actor_name ?? '', photo: n.actor_photo ?? '' }
              : undefined,
          icon: known ? ICONS[n.kind] : undefined,
          time: relativeTime(new Date(n.createdAt)),
          read: Boolean(n.read_at),
          tone: TONES[n.kind],
          href: n.link ?? undefined,
        }
      }),
    )
  }, [t])

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const every = setInterval(() => void load(), 60_000)
    const back = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', back)
    return () => {
      clearTimeout(first)
      clearInterval(every)
      document.removeEventListener('visibilitychange', back)
    }
  }, [load])

  if (!items) return null
  const markRead = (item: NotificationItem, read: boolean) =>
    void call(`/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read_at: read ? new Date().toISOString() : null }),
    })

  return (
    <NotificationCenter
      label={t('label')}
      notifications={items}
      onDismiss={(item) => void call(`/${item.id}`, { method: 'DELETE' })}
      onOpenItem={(item) => markRead(item, true)}
      onReadChange={markRead}
      text={{
        summary: (n) => t('summary', { count: n, shown: localDigits(n, locale) }),
        caughtUp: t('caughtUp'),
        close: t('close'),
        show: t('show'),
        all: t('all'),
        unread: t('unread'),
        allNotifications: t('allNotifications'),
        unreadNotifications: t('unreadNotifications'),
        markAllRead: t('markAllRead'),
        unreadSuffix: t('unreadSuffix'),
        showDetails: t('showDetails'),
        hideDetails: t('hideDetails'),
        details: t('details'),
        markRead: t('markRead'),
        markUnread: t('markUnread'),
        dismiss: t('dismiss'),
        open: t('open'),
        nothingUnread: t('nothingUnread'),
        allClear: t('allClear'),
        seenEvery: t('seenEvery'),
        newAppear: t('newAppear'),
        viewAll: t('viewAll'),
        read: t('read'),
        clearRead: t('clearRead'),
        triggerUnread: (n) => t('triggerUnread', { count: n, shown: localDigits(n, locale) }),
      }}
    />
  )
}
