'use client'

import { LogOut, UserRound } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useId, type RefObject } from 'react'

import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { LanguageSwitch, ThemeToggle } from '@/components/site-controls'
import { Link } from '@/i18n/navigation'

import { NAV_ICONS } from './nav-icons'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { SpaceRow } from './sidebar'
import type { SpaceLink } from './space-links'

/**
 * Under 700px: the nav items the bottom bar has no room for, the spaces, and
 * the account rows. Radix returns focus only to a Trigger, so closing sends
 * it back to More by hand.
 */
export function MoreSheet({
  open,
  onOpenChange,
  items,
  spaces,
  returnFocus,
  onSignOut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: PortalNavItem[]
  spaces: SpaceLink[]
  returnFocus: RefObject<HTMLButtonElement | null>
  onSignOut: () => Promise<void>
}) {
  const t = useTranslations('Portal')
  const pathname = usePathname() ?? ''
  const spacesId = useId()
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('nav.more')}
      detents={[0.92]}
      fit
      closeLabel={t('sheet.close')}
      labels={{
        expand: t('sheet.expand'),
        collapse: t('sheet.collapse'),
        expanded: t('sheet.expanded'),
        collapsed: t('sheet.collapsed'),
        height: (percent) => t('sheet.height', { percent }),
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        returnFocus.current?.focus()
      }}
    >
      <div className={styles.more}>
        {items.length > 0 && (
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
                    <a href={item.href} className={styles.row}>
                      {body}
                    </a>
                  ) : (
                    <Link href={item.href} className={styles.row}>
                      {body}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {spaces.length > 0 && (
          <section aria-labelledby={spacesId}>
            <h3 id={spacesId} className={styles.heading}>
              {t('nav.spaces')}
            </h3>
            <ul className={styles.list}>
              {spaces.map((row) => (
                <li key={row.id}>
                  <SpaceRow row={row} pathname={pathname} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <ul className={styles.list}>
          <li>
            <Link href="/settings" className={styles.row}>
              <span className={styles.icon} aria-hidden="true">
                <UserRound size={18} strokeWidth={1.75} />
              </span>
              <span className={styles.label}>{t('account.profile')}</span>
            </Link>
          </li>
        </ul>
        <div className={styles.utilities}>
          <Suspense fallback={null}>
            <LanguageSwitch full />
          </Suspense>
          <ThemeToggle full />
        </div>
        <button type="button" className={styles.row} onClick={() => void onSignOut()}>
          <span className={styles.icon} aria-hidden="true">
            <LogOut size={18} strokeWidth={1.75} />
          </span>
          <span className={styles.label}>{t('account.signOut')}</span>
        </button>
      </div>
    </BottomSheet>
  )
}
