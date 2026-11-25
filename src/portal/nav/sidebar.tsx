'use client'

import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId } from 'react'

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
 * reads. Space names use the same tooltip in expanded and folded layouts.
 */
export function Sidebar({ items, spaces }: { items: PortalNavItem[]; spaces: SpaceLink[] }) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const pathname = usePathname() ?? ''
  const spacesId = useId()
  const { folded } = useFold()
  const side = isRtl(locale) ? 'left' : 'right'
  return (
    <div className={styles.sidebar} data-folded={folded || undefined}>
      <nav id={PORTAL_NAV_ID} aria-label={t('nav.label')} className={styles.nav}>
        <ScrollArea
          fade={0}
          label={t('nav.scroll')}
          className={styles.navScroll}
          viewportClassName={styles.navViewport}
        >
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.key}>
                {folded ? (
                  <Tooltip content={t(item.labelKey)} side={side}>
                    <NavItemRow item={item} />
                  </Tooltip>
                ) : (
                  <NavItemRow item={item} />
                )}
              </li>
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
                  <li key={row.id}>
                    <Tooltip
                      content={<bdi className={styles.spaceTip}>{row.label}</bdi>}
                      side={side}
                    >
                      <SpaceRow row={row} pathname={pathname} />
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ScrollArea>
      </nav>
    </div>
  )
}
