import type { DateTimeFormatOptions } from 'next-intl'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Clock, MapPin } from 'lucide-react'

import { CAIRO } from '@/lib/cairo-day'

import styles from './space.module.css'

/** An event post's when and where, in Cairo time (ADR 0002), as a calendar leaf beside the details. */
export async function EventDetails({ startsAt, location }: { startsAt: string; location: string }) {
  const [t, format] = await Promise.all([getTranslations('SpacePost'), getFormatter()])
  const date = new Date(startsAt)
  const part = (options: DateTimeFormatOptions) =>
    format.dateTime(date, { timeZone: CAIRO, ...options })
  return (
    <section className={styles.event} aria-label={t('eventLabel')}>
      <time dateTime={startsAt} className={styles.eventLeaf} aria-hidden="true">
        <span className={styles.eventMonth}>{part({ month: 'short' })}</span>
        <span className={styles.eventDay}>{part({ day: 'numeric' })}</span>
      </time>
      <div className={styles.eventText}>
        <p className={styles.eventWhen}>
          <Clock size={15} aria-hidden="true" />
          <time dateTime={startsAt}>
            {part({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}
            {part({ hour: 'numeric', minute: '2-digit' })}
          </time>
          <span className={styles.meta}>{t('cairoTime')}</span>
        </p>
        <p className={styles.eventWhere}>
          <MapPin size={15} aria-hidden="true" />
          <bdi>{location}</bdi>
        </p>
      </div>
    </section>
  )
}
