import { Clock, MapPin } from 'lucide-react'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import type { DateTimeFormatOptions } from 'next-intl'

import { Badge } from '@/components/arc/badge/badge'
import { CAIRO, cairoDay } from '@/lib/cairo-day'
import type { SpaceEventItem } from '@/lib/spaces-data'

import styles from './space.module.css'

/**
 * A public event of the course in the Events tab: the same date leaf and lines
 * as an event post, without answers, since a public event takes none here.
 */
export async function PublicEvent({ item }: { item: Extract<SpaceEventItem, { type: 'public' }> }) {
  const [t, format, locale] = await Promise.all([
    getTranslations('SpacePost'),
    getFormatter(),
    getLocale(),
  ])
  const { startsAt, endsAt } = item
  const date = new Date(startsAt)
  const part = (options: DateTimeFormatOptions) =>
    format.dateTime(date, { timeZone: CAIRO, ...options })
  const arabic = locale === 'ar'
  const clock: DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: CAIRO,
    ...(arabic ? { hour12: false } : {}),
  }
  const sameDay = !endsAt || cairoDay(endsAt) === cairoDay(startsAt)
  return (
    <section className={styles.event} aria-label={t('publicEventAria', { title: item.title })}>
      <div className={styles.eventMain}>
        <time dateTime={startsAt} className={styles.eventLeaf} aria-hidden="true">
          <span className={styles.eventMonth}>{part({ month: 'short' })}</span>
          <span className={styles.eventDay}>{part({ day: 'numeric' })}</span>
        </time>
        <div className={styles.eventText}>
          <p className={styles.eventWhen}>
            <Clock size={15} aria-hidden="true" />
            <span className={styles.eventWhenText}>
              <time dateTime={startsAt}>
                {part({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {endsAt && sameDay ? (
                  arabic ? (
                    <bdi dir="ltr">
                      {format.dateTime(date, clock)}–{format.dateTime(new Date(endsAt), clock)}
                    </bdi>
                  ) : (
                    format.dateTimeRange(date, new Date(endsAt), clock)
                  )
                ) : (
                  part(clock)
                )}
              </time>
              <span className={styles.meta}>{t('cairoTime')}</span>
            </span>
          </p>
          {item.place && (
            <p className={styles.eventWhere}>
              <MapPin size={15} aria-hidden="true" />
              <bdi>{item.place}</bdi>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/** The mark that tells a public event from the space's own events. */
export async function PublicEventBadge() {
  const t = await getTranslations('SpacePost')
  return (
    <Badge size="sm" tone="info">
      {t('publicEvent')}
    </Badge>
  )
}
