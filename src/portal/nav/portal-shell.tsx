import { getTranslations } from 'next-intl/server'

import { CilasLogo } from '@/components/cilas-logo'
import { SiteNotifications } from '@/components/site-notifications'
import { Link } from '@/i18n/navigation'
import { LiveRegion } from '@/portal/feedback/announce'

import { AccountMenu } from './account-menu'
import { BottomBar } from './bottom-bar'
import type { PortalNavItem } from './portal-nav'
import styles from './shell.module.css'
import { Sidebar } from './sidebar'
import type { SpaceLink } from './space-links'

/**
 * Every /spaces page: the skip link, the one live region, the rail (brand,
 * bell, account menu, nav) and the one main, which holds the 1200px frame.
 * The document scrolls, not the main. Under 700px the rail's top is the
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
    <>
      <a href="#main" className={styles.skip}>
        {t('shell.skip')}
      </a>
      <LiveRegion />
      <div className={styles.shell} data-page="spaces" data-portal-shell>
        <div className={styles.rail} data-portal-rail>
          <div className={styles.top}>
            <Link href="/" className={styles.brand} aria-label={t('nav.brand')}>
              <CilasLogo className={styles.logo} />
            </Link>
            <div className={styles.tools}>
              <SiteNotifications />
              <div className={styles.account}>
                <AccountMenu />
              </div>
            </div>
          </div>
          <Sidebar items={nav} spaces={spaces} folded={folded} accountId={accountId} />
        </div>
        <main id="main" tabIndex={-1} className={styles.main}>
          <div className="mx-auto w-full max-w-300">{children}</div>
        </main>
        <BottomBar items={nav} spaces={spaces} />
      </div>
    </>
  )
}
