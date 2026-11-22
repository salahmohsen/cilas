'use client'

import { LogOut } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Suspense, useId, useMemo, useRef, useState, type RefObject } from 'react'

import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { menuUser } from '@/components/menu-user'
import { LanguageSwitch, ThemeToggle } from '@/components/site-controls'
import { useSession } from '@/components/use-session'
import { Link } from '@/i18n/navigation'

import { foldButton } from './fold-button'
import { NAV_ICONS } from './nav-icons'
import type { PortalNavItem } from './portal-nav'
import { PROFILE } from './profile'
import { NavItemRow, SpaceRow } from './rows'
import styles from './shell.module.css'
import type { SpaceLink } from './space-links'

const ProfileIcon = NAV_ICONS[PROFILE.icon]

/**
 * Under 700px: the account first (who is signed in, profile, language,
 * theme, sign out), then the nav items the bottom bar has no room for, then
 * the spaces. Radix returns focus only to a Trigger, so closing sends it
 * back to More by hand, or to the fold button once the window is wide
 * enough to hide More.
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
  const accountId = useId()
  const spacesId = useId()
  const session = useSession()
  const user = useMemo(() => (session ? menuUser(session) : null), [session])
  const pending = useRef(false)
  const [signingOut, setSigningOut] = useState(false)
  const signOut = () => {
    if (pending.current) return
    pending.current = true
    setSigningOut(true)
    void onSignOut().finally(() => {
      pending.current = false
      setSigningOut(false)
    })
  }
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
        const more = returnFocus.current
        ;(more && more.getClientRects().length > 0 ? more : foldButton())?.focus()
      }}
    >
      {/* Every link in the sheet leaves for another page: the sheet closes with it. */}
      <div
        className={styles.more}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a')) onOpenChange(false)
        }}
      >
        <section aria-labelledby={accountId} className={styles.accountGroup}>
          <h3 id={accountId} className="sr-only">
            {t('account.label')}
          </h3>
          {user && (
            <p className={styles.identity}>
              <span className={styles.identityName}>{user.name}</span>
              {user.email && <span className={styles.identityEmail}>{user.email}</span>}
            </p>
          )}
          <Link href={PROFILE.href} className={styles.row}>
            <span className={styles.icon} aria-hidden="true">
              <ProfileIcon size={18} strokeWidth={1.75} />
            </span>
            <span className={styles.label}>{t(PROFILE.labelKey)}</span>
          </Link>
          <div className={styles.utilities}>
            <Suspense fallback={null}>
              <LanguageSwitch full />
            </Suspense>
            <ThemeToggle full />
          </div>
          <button
            type="button"
            className={styles.row}
            aria-busy={signingOut || undefined}
            onClick={signOut}
          >
            <span className={styles.icon} aria-hidden="true">
              <LogOut size={18} strokeWidth={1.75} />
            </span>
            <span className={styles.label}>
              {signingOut ? t('account.signingOut') : t('account.signOut')}
            </span>
          </button>
        </section>
        {items.length > 0 && (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.key}>
                <NavItemRow item={item} />
              </li>
            ))}
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
      </div>
    </BottomSheet>
  )
}
