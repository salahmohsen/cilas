'use client'

import { Ellipsis } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { Link } from '@/i18n/navigation'
import { preloadable } from '@/lib/preloadable'
import { signOut } from '@/lib/sign-out'

import { NAV_ICONS } from './nav-icons'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import type { SpaceLink } from './space-links'

const MoreSheet = preloadable(() => import('./more-sheet').then((m) => m.MoreSheet))

/** Under 700px: the top nav items and More, fixed above the home indicator. */
export function BottomBar({ items, spaces }: { items: PortalNavItem[]; spaces: SpaceLink[] }) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const pathname = usePathname() ?? ''
  const more = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  // Kept mounted after the first open, so the sheet plays its exit.
  const [opened, setOpened] = useState(false)
  return (
    <>
      <nav aria-label={t('nav.label')} className={styles.bar}>
        <ul className={styles.barList}>
          {items
            .filter((item) => item.group === 'top')
            .map((item) => {
              const Icon = NAV_ICONS[item.icon]
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={styles.barItem}
                    aria-current={pathname === `/${locale}${item.href}` ? 'page' : undefined}
                  >
                    <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              )
            })}
          <li>
            <button
              ref={more}
              type="button"
              className={styles.barItem}
              aria-expanded={open}
              aria-haspopup="dialog"
              onPointerEnter={MoreSheet.preload}
              onFocus={MoreSheet.preload}
              onPointerDown={MoreSheet.preload}
              onClick={() => {
                setOpened(true)
                setOpen(true)
              }}
            >
              <Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" />
              <span>{t('nav.more')}</span>
            </button>
          </li>
        </ul>
      </nav>
      {opened && (
        <MoreSheet
          open={open}
          onOpenChange={setOpen}
          items={items.filter((item) => item.group !== 'top')}
          spaces={spaces}
          returnFocus={more}
          onSignOut={signOut}
        />
      )}
    </>
  )
}
