'use client'

import Image from 'next/image'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'

import { Link } from '@/i18n/navigation'

import { NAV_ICONS } from './nav-icons'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { isCurrentSpace, shownUnread, type SpaceLink } from './space-links'

/** A space: its cover, its name on one line, and its unread count as a circle and as text. */
export function SpaceRow({ row, pathname }: { row: SpaceLink; pathname: string }) {
  const t = useTranslations('Portal.nav')
  const unread = shownUnread(row, pathname)
  return (
    // The href already has its locale, so next/link, not next-intl's Link.
    <NextLink
      href={row.href}
      className={styles.row}
      aria-current={isCurrentSpace(pathname, row.href) ? 'page' : undefined}
    >
      <span className={styles.cover} aria-hidden="true">
        {row.cover && <Image src={row.cover} alt="" fill sizes="40px" />}
      </span>
      <bdi className={styles.label}>{row.label}</bdi>
      {unread > 0 && (
        <>
          <span className={styles.count} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
          <span className="sr-only">
            {unread > 9 ? t('unreadMany') : t('unread', { count: unread })}
          </span>
        </>
      )}
    </NextLink>
  )
}

/** The portal nav beside the main: the items, then the spaces the account reads. */
export function Sidebar({
  items,
  spaces,
}: {
  items: PortalNavItem[]
  spaces: SpaceLink[]
  folded: boolean
  accountId: number
}) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const pathname = usePathname()
  return (
    <nav aria-label={t('nav.label')} className={styles.nav}>
      <ul className={styles.list}>
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon]
          const body = (
            <>
              <span className={styles.icon} aria-hidden="true">
                <Icon size={18} strokeWidth={1.75} />
              </span>
              <span className={styles.label}>{t(item.labelKey)}</span>
            </>
          )
          return (
            <li key={item.key}>
              {item.external ? (
                <a href={item.href} className={styles.row} data-portal-item>
                  {body}
                </a>
              ) : (
                <Link
                  href={item.href}
                  className={styles.row}
                  data-portal-item
                  aria-current={pathname === `/${locale}${item.href}` ? 'page' : undefined}
                >
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
      {spaces.length > 0 && (
        <>
          <h2 className={styles.heading}>{t('nav.spaces')}</h2>
          <ul className={styles.list}>
            {spaces.map((row) => (
              <li key={row.id}>
                <SpaceRow row={row} pathname={pathname} />
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  )
}
