'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { ComponentProps } from 'react'

import { Link } from '@/i18n/navigation'
import { NAV_ICONS } from './nav-icons'
import { NavCountChip, NavCountSpoken } from './nav-counts'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { SpaceCover, UnreadCircle } from './space-parts'
import { useSpaceUnread } from './space-unread'
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
  const count = useSpaceUnread(shownUnread(row, pathname))
  return (
    <NextLink
      {...rest}
      href={row.href}
      className={styles.row}
      aria-current={isCurrentSpace(pathname, row.href) ? 'page' : undefined}
    >
      <SpaceCover src={row.cover} sizes="40px" className={styles.cover!} />
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
      {count && <UnreadCircle shown={count.shown} />}
    </NextLink>
  )
}
