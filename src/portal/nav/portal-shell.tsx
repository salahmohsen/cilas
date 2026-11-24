import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { CilasLogo } from '@/components/cilas-logo'
import { SiteNotifications } from '@/components/site-notifications'
import { Link } from '@/i18n/navigation'
import { LiveRegion } from '@/portal/feedback/announce'
import { PendingProvider } from '@/portal/pending/pending-provider'
import { UndoAllBar } from '@/portal/pending/undo-all-bar'

import { AccountMenu } from './account-menu'
import { BottomBar } from './bottom-bar'
import { FoldButton } from './fold-button'
import { FoldProvider } from './fold-state'
import { NavCountsProvider } from './nav-counts'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { Sidebar } from './sidebar'
import type { SpaceLink } from './space-links'

/** The shared signed-in shell. The rail has its own scrollport between its brand and controls. */
export async function PortalShell({
  nav,
  spaces,
  folded,
  accountId,
  nextSession,
  children,
}: {
  nav: PortalNavItem[]
  spaces: SpaceLink[]
  folded: boolean
  accountId: number
  nextSession: React.ReactNode
  children: React.ReactNode
}): Promise<React.JSX.Element> {
  const [t, header] = await Promise.all([getTranslations('Portal'), getTranslations('Header')])
  return (
    <FoldProvider folded={folded} accountId={accountId}>
      <NavCountsProvider key={accountId}>
        <PendingProvider>
          <a href="#main" className={styles.skip}>
            {t('shell.skip')}
          </a>
          <LiveRegion />
          <div className={styles.shell} data-page="spaces" data-portal-shell>
            <div className={styles.rail} data-portal-rail>
              <header className={styles.top}>
                <Link href="/" className={styles.brand} aria-label={t('nav.brand')}>
                  <CilasLogo className={styles.logo} height={32} width={19} />
                  <span className={styles.wordmark}>{header('brand')}</span>
                </Link>
                <FoldButton />
              </header>
              <Sidebar items={nav} spaces={spaces} />
              <footer className={styles.footer}>
                <Suspense fallback={null}>{nextSession}</Suspense>
                <div className={styles.tools}>
                  <div className={styles.account}>
                    <Suspense fallback={null}>
                      <AccountMenu />
                    </Suspense>
                  </div>
                  <SiteNotifications />
                </div>
              </footer>
            </div>
            <main className={styles.main}>
              <div id="main" tabIndex={-1} className={`${styles.content} mx-auto w-full max-w-300`}>
                {children}
              </div>
            </main>
            <UndoAllBar />
            <BottomBar items={nav} spaces={spaces} />
          </div>
        </PendingProvider>
      </NavCountsProvider>
    </FoldProvider>
  )
}
