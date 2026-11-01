import { getFormatter, getTranslations } from 'next-intl/server'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import type { Event } from '@/payload-types'
import { EventWhen } from '@/components/space/event-details'
import { cairoInstant } from '@/lib/cairo-day'
import { eventTiming } from '@/lib/events'
import { mapEmbedUrl } from '@/lib/map-embed'
import { locationUrl } from '@/lib/space-event'
import { registrationStatus } from '@/lib/registration'
import { SideCard, SideCardSection } from '@/components/side-card'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
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
  const price =
    event.pricing?.min != null
      ? event.pricing.min === 0 && !event.pricing.max
        ? t('free')
        : `${format.number(event.pricing.min)}${event.pricing.max ? `–${format.number(event.pricing.max)}` : ''} ${t('egp')}`
      : null
  const register =
    open && event.registration?.method === 'external' && registrationUrl ? (
      <a
        className="side-card-action"
        href={registrationUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('register')}
        <ArrowUpRight size={16} aria-hidden />
      </a>
    ) : open && event.registration?.method === 'form' && hasForm ? (
      <a className="side-card-action" href="#event-registration">
        {t('register')}
        <ArrowDown size={16} aria-hidden />
      </a>
    ) : null
  return (
    <SideCard
      as="aside"
      className={styles.attendance}
      color={EVENT_POSTER_COLORS[event.event_type]}
      label={t('details')}
    >
      <SideCardSection label={t('when')}>
        <div className="side-card-body">
          {timing.meeting ? (
            <EventWhen
              startsAt={cairoInstant(timing.meeting.date, timing.meeting.start_time)!}
              endsAt={cairoInstant(timing.meeting.date, timing.meeting.end_time)}
              over={timing.status === 'past'}
            />
          ) : (
            <>
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
                <p className="side-card-muted">
                  {timing.status === 'past' ? t('ended') : t('timeSoon')}
                </p>
              )}
            </>
          )}
          {event.schedule?.note && <p className="side-card-muted">{event.schedule.note}</p>}
        </div>
      </SideCardSection>
      {(venue || online) && (
        <SideCardSection label={t('where')}>
          {embed && (
            <iframe
              className="side-card-media"
              src={embed}
              title={spaces('placeMap', { name: venue?.name || t('where') })}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          )}
          <div className="side-card-body">
            {venue && (
              <>
                <p className="font-semibold" dir="auto">
                  {venue.name}
                </p>
                {venue.address && (
                  <p className="side-card-muted" dir="auto">
                    {venue.address}
                  </p>
                )}
                {!embed && mapUrl && (
                  <a
                    className="side-card-link"
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {spaces('openInMaps')}
                    <ArrowUpRight size={16} aria-hidden />
                  </a>
                )}
              </>
            )}
            {online && (
              <a className="side-card-link" href={online} target="_blank" rel="noopener noreferrer">
                {t('joinOnline')}
                <ArrowUpRight size={16} aria-hidden />
              </a>
            )}
          </div>
        </SideCardSection>
      )}
      <SideCardSection label={t('admission')}>
        <div className="side-card-body">
          {price && <p className="font-semibold">{price}</p>}
          {event.pricing?.note && <p className="side-card-muted">{event.pricing.note}</p>}
          {!register && (
            <p className="side-card-muted">
              {timing.status === 'past'
                ? t('ended')
                : !open && event.registration?.method
                  ? t('registrationClosed')
                  : t('admissionSoon')}
            </p>
          )}
        </div>
        {register}
      </SideCardSection>
    </SideCard>
  )
}
