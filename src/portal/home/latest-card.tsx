import { useTranslations } from 'next-intl'

import buttonStyles from '@/components/arc/button/button.module.css'
import { Link } from '@/i18n/navigation'
import type { StoredNotification } from '@/lib/realtime/events'
import { LatestList } from '@/portal/needs/latest-list'
import styles from './home.module.css'

export function LatestCard({ rows }: { rows: StoredNotification[] }) {
  const home = useTranslations('Portal.home')
  const latest = useTranslations('Portal.latest')
  return (
    <section aria-labelledby="home-latest" className={styles.section} data-latest>
      <h2 id="home-latest" className={styles.heading}>
        {latest('heading')}
      </h2>
      <LatestList page={{ rows, pages: 1, more: null }} focus={false} />
      <Link
        href="/spaces/inbox"
        className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md} ${styles.action}`}
      >
        {home('openInbox')}
      </Link>
    </section>
  )
}
