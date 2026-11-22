import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { CilasLogo } from '@/components/cilas-logo'
import { SiteNotifications } from '@/components/site-notifications'
import { Link } from '@/i18n/navigation'
import { LiveRegion } from '@/portal/feedback/announce'

import { AccountMenu } from './account-menu'
import { BottomBar } from './bottom-bar'
import { FoldButton } from './fold-button'
import { FoldProvider } from './fold-state'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { Sidebar } from './sidebar'
import type { SpaceLink } from './space-links'

/**
 * Every /spaces page: the skip link, the one live region, the rail (its
 * header with the brand, bell and account menu, then the nav) and the one
 * main: a header row with the fold button (a later phase adds the trail
 * there), then the 1200px frame, which the skip link targets. The document scrolls, not the main. Under 700px the rail's top is the
 * phone header and the nav moves to the bottom bar.
 */
export async function PortalShell({
  nav,
  spaces,
  folded,
  accountId,
  children,
}: {
  nav: PortalNavItem[]
  spaces: SpaceLink[]
  folded: boolean
  accountId: number
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const t = await getTranslations('Portal')
  return (
    <FoldProvider folded={folded} accountId={accountId}>
      <a href="#main" className={styles.skip}>
        {t('shell.skip')}
      </a>
      <LiveRegion />
      <div className={styles.shell} data-page="spaces" data-portal-shell>
        <div className={styles.rail} data-portal-rail>
          <header className={styles.top}>
            <Link href="/" className={styles.brand} aria-label={t('nav.brand')}>
              <CilasLogo className={styles.logo} />
            </Link>
            <div className={styles.tools}>
              <SiteNotifications />
              <div className={styles.account}>
                <Suspense fallback={null}>
                  <AccountMenu />
                </Suspense>
              </div>
            </div>
          </header>
          <Sidebar items={nav} spaces={spaces} />
        </div>
        <main className={styles.main}>
          <div className={styles.crumbs} data-portal-crumbs>
            <FoldButton />
          </div>
          <div id="main" tabIndex={-1} className={`${styles.content} mx-auto w-full max-w-300`}>
            {children}
          </div>
        </main>
        <BottomBar items={nav} spaces={spaces} />
      </div>
    </FoldProvider>
  )
}
