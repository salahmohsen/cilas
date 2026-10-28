import type { ReactNode } from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'
import type { Locale } from '@/api/articles.api'
import { getPublicEvents } from '@/api/events.api'
import { EventCarousel } from '@/components/events/event-carousel'
import { PastEventsGrid } from '@/components/events/past-events-grid'
import { PublicEventCard } from '@/components/events/public-event-card'
import { EventGrid } from '@/components/events/event-grid'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { eventTiming, orderEvents } from '@/lib/events'
import styles from '@/components/events/events.module.css'

export const revalidate = 60

export async function generateMetadata() {
  const t = await getTranslations('Events')
  return { title: t('title'), description: t('intro') }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>
  searchParams: Promise<{ type?: string; page?: string }>
}) {
  const [{ locale }, selected] = await Promise.all([params, searchParams])
  const [t, types, payload] = await Promise.all([
    getTranslations('Events'),
    getTranslations('Calendar.eventTypes'),
    getPayload({ config }),
  ])
  const now = new Date()
  const events = await getPublicEvents(payload, locale)
  const groups = orderEvents(events, now)
  const cards: Record<string, ReactNode> = {}
  const typeLabels: Record<string, string> = {}
  const posts = groups.past.map((event) => {
    const id = String(event.id)
    cards[id] = <PublicEventCard event={event} now={now} />
    typeLabels[event.event_type] = types(event.event_type)
    return {
      id,
      title: event.title,
      category: types(event.event_type),
      date: eventTiming(event, now).day!,
      excerpt: '',
      readTime: 0,
      author: { name: '' },
    }
  })
  const page = Number(selected.page)
  const initialPage = Number.isSafeInteger(page) && page > 0 ? page : 1
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>{t('title')}</h1>
        <p>{t('intro')}</p>
      </header>
      <section className={styles.section} aria-labelledby="upcoming-events">
        <h2 id="upcoming-events">{t('upcoming')}</h2>
        {groups.upcoming.length ? (
          <EventCarousel label={t('upcoming')}>
            {groups.upcoming.map((event) => (
              <div key={event.id} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                <PublicEventCard event={event} now={now} />
              </div>
            ))}
          </EventCarousel>
        ) : (
          <EmptyState title={t('empty')} description={t('emptyText')} />
        )}
      </section>
      {groups.undated.length > 0 && (
        <section className={styles.section} aria-labelledby="undated-events">
          <h2 id="undated-events">{t('undated')}</h2>
          <EventGrid events={groups.undated} now={now} />
        </section>
      )}
      {groups.past.length > 0 && (
        <section className={styles.section} aria-labelledby="past-events">
          <h2 id="past-events">{t('past')}</h2>
          <PastEventsGrid
            posts={posts}
            cards={cards}
            categories={Object.values(typeLabels)}
            types={typeLabels}
            initialType={selected.type}
            initialPage={initialPage}
          />
        </section>
      )}
    </div>
  )
}
