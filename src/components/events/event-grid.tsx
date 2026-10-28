import Image from 'next/image'
import { CalendarDays, MapPin } from 'lucide-react'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { localDigits } from '@/lib/digits'
import { eventTiming } from '@/lib/events'
import type { Event } from '@/payload-types'
import styles from './events.module.css'

export async function EventGrid({ events, now }: { events: Event[]; now: Date }) {
  const [t, types, format, locale] = await Promise.all([
    getTranslations('Events'),
    getTranslations('Calendar.eventTypes'),
    getFormatter(),
    getLocale(),
  ])
  return (
    <ul className={styles.grid}>
      {events.map((event) => {
        const timing = eventTiming(event, now)
        const cover = typeof event.cover_image === 'object' ? event.cover_image : null
        const place = typeof event.place === 'object' ? event.place : null
        const where =
          event.external_venue?.name || place?.name || (event.online_url ? t('online') : null)
        return (
          <li key={event.id}>
            <Link href={`/events/${event.slug}`} className={styles.card}>
              <div className={styles.image}>
                {cover?.url ? (
                  <Image
                    src={cover.sizes?.card?.url || cover.url}
                    alt={cover.alt || ''}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw"
                  />
                ) : (
                  <CalendarDays size={40} strokeWidth={1} aria-hidden />
                )}
              </div>
              <div className={styles.info}>
                <p className={styles.meta}>{types(event.event_type)}</p>
                <h3>{event.title}</h3>
                {timing.day ? (
                  <time dateTime={timing.day}>
                    {format.dateTime(new Date(`${timing.day}T12:00:00Z`), {
                      dateStyle: 'long',
                      timeZone: 'Africa/Cairo',
                    })}
                  </time>
                ) : (
                  <p>{t('dateSoon')}</p>
                )}
                {timing.meeting && (
                  <p className={styles.meta}>
                    <bdi>
                      {localDigits(
                        `${timing.meeting.start_time}–${timing.meeting.end_time}`,
                        locale,
                      )}
                    </bdi>{' '}
                    · {t('cairoTime')}
                  </p>
                )}
                {where && (
                  <p className={styles.place}>
                    <MapPin size={14} aria-hidden />
                    {where}
                  </p>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
