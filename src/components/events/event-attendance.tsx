import { getFormatter, getTranslations } from 'next-intl/server'
import { ArrowUpRight } from 'lucide-react'
import type { Event } from '@/payload-types'
import { EventWhen } from '@/components/space/event-details'
import { cairoInstant } from '@/lib/cairo-day'
import { eventTiming } from '@/lib/events'
import { mapEmbedUrl } from '@/lib/map-embed'
import { locationUrl } from '@/lib/space-event'
import { registrationStatus } from '@/lib/registration'
import spaceStyles from '@/components/space/space.module.css'
import styles from './events.module.css'

export async function EventAttendance({
  event,
  now,
  locale,
}: {
  event: Event
  now: Date
  locale: string
}) {
  const [t, spaces, format] = await Promise.all([
    getTranslations('Events'),
    getTranslations('Spaces'),
    getFormatter(),
  ])
  const timing = eventTiming(event, now)
  const place = typeof event.place === 'object' ? event.place : null
  const venue = event.external_venue?.name ? event.external_venue : place
  const mapUrl = locationUrl(venue?.map_url)
  const embed = venue ? await mapEmbedUrl({ address: venue.address || null, mapUrl }, locale) : null
  const online = locationUrl(event.online_url)
  const open =
    timing.status !== 'past' && registrationStatus(event.registration, null, now) === 'open'
  const registrationUrl = locationUrl(event.registration?.url)
  const hasForm = typeof event.registration?.form === 'object' && event.registration.form !== null
  return (
    <aside className={styles.attendance} aria-label={t('details')}>
      <section className={styles.railSection}>
        <h2>{t('when')}</h2>
        {timing.meeting ? (
          <EventWhen
            startsAt={cairoInstant(timing.meeting.date, timing.meeting.start_time)!}
            endsAt={cairoInstant(timing.meeting.date, timing.meeting.end_time)}
            over={timing.status === 'past'}
          />
        ) : (
          <div className={styles.railText}>
            {timing.day ? (
              <time dateTime={timing.day}>
                {format.dateTime(new Date(`${timing.day}T12:00:00Z`), {
                  dateStyle: 'full',
                  timeZone: 'Africa/Cairo',
                })}
              </time>
            ) : (
              <p>{t('dateSoon')}</p>
            )}
            {(timing.day || timing.status === 'past') && (
              <p className={styles.secondary}>
                {timing.status === 'past' ? t('ended') : t('timeSoon')}
              </p>
            )}
          </div>
        )}
        {event.schedule?.note && <p className={styles.secondary}>{event.schedule.note}</p>}
      </section>
      {(venue || online) && (
        <section className={styles.railSection}>
          <h2>{t('where')}</h2>
          {embed && (
            <iframe
              className={spaceStyles.placeMap}
              src={embed}
              title={spaces('placeMap', { name: venue?.name || t('where') })}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          {venue && (
            <div className={styles.railText}>
              <p dir="auto">{venue.name}</p>
              {venue.address && (
                <p className={styles.secondary} dir="auto">
                  {venue.address}
                </p>
              )}
              {!embed && mapUrl && (
                <a
                  className={styles.railLink}
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {spaces('openInMaps')}
                  <ArrowUpRight size={16} aria-hidden />
                </a>
              )}
            </div>
          )}
          {online && (
            <a className={styles.railLink} href={online} target="_blank" rel="noopener noreferrer">
              {t('joinOnline')}
              <ArrowUpRight size={16} aria-hidden />
            </a>
          )}
        </section>
      )}
      <section className={styles.railSection}>
        <h2>{t('admission')}</h2>
        {event.pricing?.min != null && (
          <p>
            {event.pricing.min === 0 && !event.pricing.max
              ? t('free')
              : `${format.number(event.pricing.min)}${event.pricing.max ? `–${format.number(event.pricing.max)}` : ''} ${t('egp')}`}
          </p>
        )}
        {event.pricing?.note && <p className={styles.secondary}>{event.pricing.note}</p>}
        {open && event.registration?.method === 'external' && registrationUrl ? (
          <a
            className={styles.register}
            href={registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('register')}
            <ArrowUpRight size={16} aria-hidden />
          </a>
        ) : open && event.registration?.method === 'form' && hasForm ? (
          <a className={styles.register} href="#event-registration">
            {t('register')}
          </a>
        ) : (
          <p className={styles.secondary}>
            {timing.status === 'past'
              ? t('ended')
              : !open && event.registration?.method
                ? t('registrationClosed')
                : t('admissionSoon')}
          </p>
        )}
      </section>
    </aside>
  )
}
