import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import buttonStyles from '@/components/arc/button/button.module.css'
import type { Locale } from '@/i18n/routing'
import type { User } from '@/payload-types'
import { PortalPageHeader } from '@/portal/lists/page-header'
import { latestRows } from '@/portal/needs/latest'
import { LatestList } from '@/portal/needs/latest-list'
import { NeedList } from '@/portal/needs/need-list'
import { needs } from '@/portal/needs/needs'
import styles from '@/portal/needs/needs.module.css'
import { RefreshOnWork } from '@/portal/needs/refresh-on-work'
import { SectionBoundary } from '@/portal/needs/section-boundary'

async function NeedsSection({ user, locale }: { user: User; locale: Locale }) {
  const result = await needs(user, locale)
  return <NeedList result={result} group={false} />
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
  const t = await getTranslations('Portal')
  return (
    <>
      <RefreshOnWork />
      <PortalPageHeader title={t('inbox.title')}>
        <a
          href="#latest"
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md}`}
        >
          {t('inbox.jumpToLatest')}
        </a>
      </PortalPageHeader>
      <div className={styles.sections}>
        <SectionBoundary>
          <NeedsSection user={user} locale={locale} />
        </SectionBoundary>
        <section className={styles.section} data-latest>
          <h2 id="latest" tabIndex={-1} className={styles.heading}>
            {t('latest.heading')}
          </h2>
          <SectionBoundary>
            <LatestSection user={user} pages={pages} focus={focus} />
          </SectionBoundary>
        </section>
      </div>
    </>
  )
}
