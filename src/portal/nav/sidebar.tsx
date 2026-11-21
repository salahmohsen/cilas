'use client'

import { ChevronLeft } from 'lucide-react'
import Image from 'next/image'
import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState, type ComponentProps, type KeyboardEvent, type ReactElement } from 'react'

import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { Link } from '@/i18n/navigation'
import { isRtl } from '@/i18n/routing'

import { writeFold } from './fold'
import { NAV_ICONS } from './nav-icons'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { isCurrentSpace, shownUnread, type SpaceLink } from './space-links'

/** A space: its cover, its name on one line, and its unread count as a circle and as text. */
export function SpaceRow({
  row,
  pathname,
  ...rest
}: { row: SpaceLink; pathname: string } & Omit<ComponentProps<typeof NextLink>, 'href'>) {
  const t = useTranslations('Portal.nav')
  const unread = shownUnread(row, pathname)
  return (
    <NextLink
      {...rest}
      href={row.href}
      className={styles.row}
      aria-current={isCurrentSpace(pathname, row.href) ? 'page' : undefined}
    >
      <span className={styles.cover} aria-hidden="true">
        {row.cover && <Image src={row.cover} alt="" fill sizes="40px" />}
        {unread > 0 && <span className={styles.dot} />}
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

const editable = (target: EventTarget) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/**
 * The portal nav beside the main: a fold button, the items, then the spaces
 * the account reads. Folded, rows keep their names as hidden text and show
 * them in a tooltip. `[` folds while focus is inside (WCAG 2.1.4).
 */
export function Sidebar({
  items,
  spaces,
  folded: foldedAtLoad,
  accountId,
}: {
  items: PortalNavItem[]
  spaces: SpaceLink[]
  folded: boolean
  accountId: number
}) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const pathname = usePathname() ?? ''
  const navId = useId()
  const [folded, setFolded] = useState(foldedAtLoad)
  const toggle = () => {
    writeFold(accountId, !folded)
    setFolded(!folded)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'BracketLeft' || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.shiftKey || editable(event.target)) return
    event.preventDefault()
    toggle()
  }
  const side = isRtl(locale) ? 'left' : 'right'
  const tip = (label: string, row: ReactElement) =>
    folded ? (
      <Tooltip content={label} side={side}>
        {row}
      </Tooltip>
    ) : (
      row
    )
  return (
    <div className={styles.sidebar} data-folded={folded || undefined} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={styles.fold}
        aria-expanded={!folded}
        aria-controls={navId}
        aria-label={t('nav.fold')}
        onClick={toggle}
      >
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
      </button>
      <nav id={navId} aria-label={t('nav.label')} className={styles.nav}>
        <ul className={styles.list}>
          {items.map((item) => {
            const Icon = NAV_ICONS[item.icon]
            const label = t(item.labelKey)
            const body = (
              <>
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span className={styles.label}>{label}</span>
              </>
            )
            return (
              <li key={item.key}>
                {tip(
                  label,
                  item.external ? (
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
                  ),
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
                <li key={row.id}>{tip(row.label, <SpaceRow row={row} pathname={pathname} />)}</li>
              ))}
            </ul>
          </>
        )}
      </nav>
    </div>
  )
}
