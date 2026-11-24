import { useTranslations } from 'next-intl'

import { PortalPageHeader } from '@/portal/lists/page-header'
import { HomeCardSkeleton } from './card-boundary'
import styles from './home.module.css'

export function HomeLoading() {
  const t = useTranslations('Portal.home')
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        {t('loading')}
      </p>
      <PortalPageHeader title={t('greeting')} />
      <div className={styles.board}>
        {[0, 1, 2, 3].map((card) => (
          <HomeCardSkeleton key={card} />
        ))}
      </div>
    </div>
  )
}
