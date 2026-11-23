import { useTranslations } from 'next-intl'

import { Skeleton } from '@/components/arc/skeleton/skeleton'
import { PortalPageHeader } from '@/portal/lists/page-header'
import styles from '@/portal/needs/needs.module.css'

/** What `inbox/loading.tsx` shows while the page reads: the title, then a placeholder for each section. */
export function InboxSkeleton() {
  const t = useTranslations('Portal.inbox')
  return (
    <div data-inbox-skeleton aria-busy="true">
      <PortalPageHeader title={t('title')} />
      <div role="status" aria-label={t('loading')} className={styles.sections}>
        <Skeleton lines={3} label={t('loading')} />
        <Skeleton lines={4} avatar label={t('loading')} />
      </div>
    </div>
  )
}
