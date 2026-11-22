import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import type { Locale } from '@/i18n/routing'
import type { User } from '@/payload-types'
import { PortalPageHeader } from '@/portal/lists/page-header'
import { latestRows } from '@/portal/needs/latest'
import { LatestList } from '@/portal/needs/latest-list'
import { NeedList } from '@/portal/needs/need-list'
import { needs } from '@/portal/needs/needs'
import styles from '@/portal/needs/needs.module.css'
import { SectionBoundary } from '@/portal/needs/section-boundary'

async function NeedsSection({ user, locale }: { user: User; locale: Locale }) {
  const [t, { rows, failed }] = await Promise.all([getTranslations('Portal'), needs(user, locale)])
  return (
    <>
      {failed.length > 0 && (
        <p className={styles.notice} role="status">
          {t('needs.someFailed')}
        </p>
      )}
      {rows.length > 0 ? (
        <NeedList rows={rows} group={false} />
      ) : (
        failed.length === 0 && (
          <section className={styles.section}>
            <h2 className={styles.heading}>{t('needs.heading')}</h2>
            <p className={styles.empty}>{t('needs.empty')}</p>
          </section>
        )
      )}
    </>
  )
}

async function LatestSection({
  user,
  pages,
  focus,
}: {
  user: User
  pages: number
  focus: boolean
}) {
  const payload = await getPayload({ config })
  return <LatestList page={await latestRows(payload, user, pages)} focus={focus} />
}

/** Inbox: the work that waits on the reader, then the newest notifications. Each section loads on its own. */
export async function InboxPage({
  user,
  locale,
  pages,
  focus,
}: {
  user: User
  locale: Locale
  pages: number
  focus: boolean
}) {
  const t = await getTranslations('Portal.inbox')
  return (
    <>
      <PortalPageHeader title={t('title')} />
      <div className={styles.sections}>
        <SectionBoundary>
          <NeedsSection user={user} locale={locale} />
        </SectionBoundary>
        <SectionBoundary>
          <LatestSection user={user} pages={pages} focus={focus} />
        </SectionBoundary>
      </div>
    </>
  )
}
