import { type Locale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getTranslations } from 'next-intl/server'

import { getPublicEvents } from '@/api/events.api'

import { otherUpcomingEvents } from '@/lib/events'
import { EventGrid } from './event-grid'
import styles from './events.module.css'

export async function UpcomingEvents({
  currentId,
  locale,
  now,
}: {
  currentId: number
  locale: Locale
  now: Date
}) {
  const [payload, t] = await Promise.all([getPayload({ config }), getTranslations('Events')])
  const events = otherUpcomingEvents(await getPublicEvents(payload, locale), currentId, now)
  if (!events.length) return null
  return (
    <section className={`${styles.page} ${styles.related}`} aria-labelledby="other-upcoming-events">
      <h2 id="other-upcoming-events">{t('moreUpcoming')}</h2>
      <EventGrid events={events} now={now} />
    </section>
  )
}
