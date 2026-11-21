'use client'

import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId, type ReactElement } from 'react'

import { ScrollArea } from '@/components/arc/scroll-area/scroll-area'
import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { isRtl } from '@/i18n/routing'

import { PORTAL_NAV_ID } from './fold'
import { useFold } from './fold-state'
import type { PortalNavItem } from './portal-nav'
import { NavItemRow, SpaceRow } from './rows'
import styles from './shell.module.css'
import type { SpaceLink } from './space-links'

/**
 * The portal nav beside the main: the items, then the spaces the account
 * reads. Folded (`useFold`), rows keep their names as hidden text and show
 * them in a tooltip. The fold button and the `[` key live in the main's
 * header row (`FoldButton`, `FoldProvider`).
 */
export function Sidebar({ items, spaces }: { items: PortalNavItem[]; spaces: SpaceLink[] }) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const pathname = usePathname() ?? ''
  const spacesId = useId()
  const { folded } = useFold()
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
    <div className={styles.sidebar} data-folded={folded || undefined}>
      <nav id={PORTAL_NAV_ID} aria-label={t('nav.label')} className={styles.nav}>
        <ScrollArea
          fade={0}
          scrollbars="always"
          label={t('nav.scroll')}
          className={styles.navScroll}
          viewportClassName={styles.navViewport}
        >
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
        </ScrollArea>
      </nav>
    </div>
  )
}
