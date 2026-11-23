'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useState } from 'react'
import { formatDistanceToNow, isYesterday } from 'date-fns'

import {
  NotificationCenter,
  type NotificationItem,
} from '@/components/arc/notification-center/notification-center'
import { useToastStack } from '@/components/arc/toast-stack/toast-stack'
import { NOTIFICATION_GLYPHS } from '@/components/notification-glyphs'
import { localDigits } from '@/lib/digits'
import { unreadCount } from '@/lib/unread-count'
import { isNotificationKind, NOTIFICATION_KINDS } from '@/lib/notification-kinds'
import {
  dismiss,
  isOwnTab,
  loadNotifications,
  markRead as saveRead,
  noteText,
} from '@/lib/notifications-client'
import type { ClientNotificationEvent, StoredNotification } from '@/lib/realtime/events'
import { useNotificationFeed } from '@/components/use-notification-feed'

const LIMIT = 20

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
 * marking one read here marks it there. Changes arrive live from the tab's
 * stream (src/lib/realtime/stream-client.ts); a new one also shows a toast,
 * except in the tab whose action caused it. It loads again when the stream
 * comes back after a gap and when the tab comes back into view.
 */
export function SiteNotifications() {
  const t = useTranslations('Notifications')
  const locale = useLocale()
  const { toast } = useToastStack()
  const [items, setItems] = useState<NotificationItem[] | null>(null)

  const toItem = useCallback(
    (n: StoredNotification): NotificationItem => {
      const kind = isNotificationKind(n.kind) ? NOTIFICATION_KINDS[n.kind] : null
      const { label, detail } = noteText(n, (k) => t(`kinds.${k}`))
      return {
        id: String(n.id),
        title: label,
        description: detail,
        actor:
          n.actor_name || n.actor_photo
            ? { name: n.actor_name ?? '', photo: n.actor_photo ?? '' }
            : undefined,
        icon: kind ? NOTIFICATION_GLYPHS[kind.icon] : undefined,
        time: relativeTime(new Date(n.createdAt)),
        read: Boolean(n.read_at),
        tone: kind?.tone,
        href: n.link ?? undefined,
      }
    },
    [t],
  )

  const load = useCallback(async () => {
    const docs = await loadNotifications(LIMIT)
    if (docs) setItems(docs.map(toItem))
  }, [toItem])

  const markRead = useCallback(
    (item: NotificationItem, read: boolean) => void saveRead(item.id, read),
    [],
  )

  const onEvent = useCallback(
    (event: ClientNotificationEvent) => {
      const id = String(event.id)
      if (event.op === 'deleted') {
        setItems((list) => list?.filter((item) => item.id !== id) ?? list)
        return
      }
      // Too big for one database message: the row comes from the API instead.
      if (!event.doc) return void load()
      const item = toItem(event.doc)
      if (event.op === 'updated') {
        setItems((list) => list?.map((entry) => (entry.id === id ? item : entry)) ?? list)
        return
      }
      setItems((list) => [item, ...(list ?? []).filter((entry) => entry.id !== id)].slice(0, LIMIT))
      if (isOwnTab(event)) return
      toast({
        type: item.tone ?? 'info',
        title: item.title,
        description: item.description,
        action: item.href
          ? {
              label: t('open'),
              onClick: () => {
                markRead(item, true)
                window.location.assign(item.href!)
              },
            }
          : undefined,
      })
    },
    [load, markRead, t, toItem, toast],
  )

  useNotificationFeed({ load, onEvent })

  if (!items) return null

  return (
    <NotificationCenter
      label={t('label')}
      notifications={items}
      onDismiss={(item) => void dismiss(item.id)}
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
        unreadCount: (n) =>
          unreadCount(n, locale, {
            some: (values) => t('triggerUnread', values),
            many: (values) => t('triggerUnreadMany', values),
          }),
      }}
    />
  )
}
