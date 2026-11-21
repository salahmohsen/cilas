'use client'

import { ChevronLeft } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState, type KeyboardEvent, type ReactElement } from 'react'

import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { isRtl } from '@/i18n/routing'

import { writeFold } from './fold'
import type { PortalNavItem } from './portal-nav'
import { NavItemRow, SpaceRow } from './rows'
import styles from './shell.module.css'
import type { SpaceLink } from './space-links'

const editable = (target: EventTarget) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** The fold button, where focus goes when the More sheet closes because the window grew past the phone layout. */
export const foldButton = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-portal-fold]')

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
  const spacesId = useId()
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
        aria-label={t('nav.sidebar')}
        data-portal-fold
        onClick={toggle}
      >
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
      </button>
      <nav id={navId} aria-label={t('nav.label')} className={styles.nav}>
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.key}>{tip(t(item.labelKey), <NavItemRow item={item} />)}</li>
          ))}
        </ul>
        {spaces.length > 0 && (
          <>
            {/* A label, not a heading: the rail comes before the page's h1. */}
            <span id={spacesId} className={styles.heading}>
              {t('nav.spaces')}
            </span>
            <ul className={styles.list} aria-labelledby={spacesId}>
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
