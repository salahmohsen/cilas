import config from '@payload-config'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/api/articles.api'
import { getPublicEvents } from '@/api/events.api'
import { EventGrid } from '@/components/events/event-grid'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { orderEvents } from '@/lib/events'
import styles from '@/components/events/events.module.css'

export const revalidate = 60

export async function generateMetadata() {
  const t = await getTranslations('Events')
  return { title: t('title'), description: t('intro') }
}

export default async function Page({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const [t, payload] = await Promise.all([getTranslations('Events'), getPayload({ config })])
  const now = new Date()
  const events = await getPublicEvents(payload, locale)
  const groups = orderEvents(events, now)
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
      </header>
      <section className={styles.section} aria-labelledby="upcoming-events">
        <h2 id="upcoming-events">{t('upcoming')}</h2>
        {groups.upcoming.length ? (
          <EventGrid events={groups.upcoming} now={now} />
        ) : (
          <EmptyState title={t('empty')} description={t('emptyText')} />
        )}
      </section>
      {(['undated', 'past'] as const).map((group) =>
        groups[group].length ? (
          <section key={group} className={styles.section} aria-labelledby={`${group}-events`}>
            <h2 id={`${group}-events`}>{t(group)}</h2>
            <EventGrid events={groups[group]} now={now} />
          </section>
        ) : null,
      )}
    </div>
  )
}
