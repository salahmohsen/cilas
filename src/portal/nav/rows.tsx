'use client'

import Image from 'next/image'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState, type ComponentProps } from 'react'

import { Link } from '@/i18n/navigation'
import { unreadCount } from '@/lib/unread-count'

import { NAV_ICONS } from './nav-icons'
import { NavCountChip, NavCountSpoken } from './nav-counts'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { isCurrentItem, isCurrentSpace, shownUnread, type SpaceLink } from './space-links'

/** A nav item: its icon and its name. An item that leaves the portal is a plain link (a full load). */
export function NavItemRow({
  item,
  ...rest
}: { item: PortalNavItem } & Omit<ComponentProps<'a'>, 'href' | 'children'>) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const pathname = usePathname() ?? ''
  const Icon = NAV_ICONS[item.icon]
  const props = {
    ...rest,
    className: styles.row,
    'data-portal-item': true,
    'data-group': item.group,
  }
  const body = (
    <>
      <span className={styles.icon} aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className={styles.label}>
        <span className="sr-only">
          {t(item.labelKey)}
          <NavCountSpoken itemKey={item.key} />
        </span>
        <span aria-hidden="true">{t(item.labelKey)}</span>
      </span>
      <NavCountChip itemKey={item.key} />
    </>
  )
  return item.external ? (
    <a {...props} href={item.href}>
      {body}
    </a>
  ) : (
    <Link
      {...props}
      href={item.href}
      aria-current={isCurrentItem(pathname, locale, item) ? 'page' : undefined}
    >
      {body}
    </Link>
  )
}

/**
 * A space: its cover, its whole name, and its unread count as a circle and
 * as text. A cover that fails to load leaves the empty slot.
 */
export function SpaceRow({
  row,
  pathname,
  ...rest
}: { row: SpaceLink; pathname: string } & Omit<ComponentProps<typeof NextLink>, 'href'>) {
  const t = useTranslations('Portal.nav')
  const locale = useLocale()
  const [coverFailed, setCoverFailed] = useState(false)
  const unread = shownUnread(row, pathname)
  const count =
    unread > 0
      ? unreadCount(unread, locale, {
          some: (values) => t('unread', values),
          many: (values) => t('unreadMany', values),
        })
      : null
  return (
    <NextLink
      {...rest}
      href={row.href}
      className={styles.row}
      aria-current={isCurrentSpace(pathname, row.href) ? 'page' : undefined}
    >
      <span className={styles.cover} aria-hidden="true">
        {row.cover && !coverFailed && (
          <Image src={row.cover} alt="" fill sizes="40px" onError={() => setCoverFailed(true)} />
        )}
        {count && <span className={styles.dot} />}
      </span>
      {/* The name keeps the page's alignment; <bdi> only isolates its direction. With a count, the
          hidden text holds the name and the count together, so the link's name has no gap before the comma. */}
      <span className={styles.label}>
        {count ? (
          <>
            <span className="sr-only">
              <bdi>{row.label}</bdi>
              {count.spoken}
            </span>
            <bdi aria-hidden="true">{row.label}</bdi>
          </>
        ) : (
          <bdi>{row.label}</bdi>
        )}
      </span>
      {count && (
        <span className={styles.count} aria-hidden="true" dir="ltr">
          {count.shown}
        </span>
      )}
    </NextLink>
  )
}
