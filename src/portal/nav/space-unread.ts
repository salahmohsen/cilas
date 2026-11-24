import { useLocale, useTranslations } from 'next-intl'

import { unreadCount } from '@/lib/unread-count'

/** A space's unread posts in the reader's words, or null with none. Server and client components call it. */
export function useSpaceUnread(count: number) {
  const t = useTranslations('Portal.nav')
  const locale = useLocale()
  return count > 0
    ? unreadCount(count, locale, {
        some: (values) => t('unread', values),
        many: (values) => t('unreadMany', values),
      })
    : null
}
