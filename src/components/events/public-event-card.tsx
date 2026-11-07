import { detailPath } from '@/lib/paths'
import { listSeparator } from '@/lib/locale-format'
import { CAIRO, cairoNoon } from '@/lib/cairo-day'
import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  Clapperboard,
  DoorOpen,
  Drama,
  Footprints,
  House,
  Images,
  Mic,
  Music,
  PencilRuler,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Poster, type PosterData } from '@/components/home/poster'
import { EventPlace, EventWhen } from '@/components/space/event-details'
import readerStyles from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { cairoInstant } from '@/lib/cairo-day'
import { numberingSystemOf } from '@/lib/digits'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import { locationUrl } from '@/lib/space-event'
import { mediaImage } from '@/lib/media-image'
import { eventTiming } from '@/lib/events'
import type { Event } from '@/payload-types'
import spaceStyles from '@/components/space/space.module.css'
import styles from './events.module.css'

const TYPE_ICONS: Record<Event['event_type'], LucideIcon> = {
  talk: Mic,
  panel: UsersRound,
  book_discussion: BookOpen,
  reading_group: BookOpenText,
  screening: Clapperboard,
  performance: Drama,
  music: Music,
  exhibition: Images,
  open_day: DoorOpen,
  workshop: PencilRuler,
  residency: House,
  visit: Footprints,
  other: CalendarDays,
}

export async function PublicEventCard({
  event,
  now,
  detail = false,
  showFacts = true,
}: {
  event: Event
  now: Date
  detail?: boolean
  showFacts?: boolean
}) {
  const [t, types, format, locale] = await Promise.all([
    getTranslations('Events'),
    getTranslations('Calendar.eventTypes'),
    getFormatter(),
    getLocale(),
  ])
  const timing = eventTiming(event, now)
  const cover = typeof event.cover_image === 'object' ? event.cover_image : null
  const place = typeof event.place === 'object' ? event.place : null
  const venue = event.external_venue?.name ? event.external_venue : place
  const startsAt = timing.day
    ? cairoInstant(timing.day, timing.meeting?.start_time ?? '12:00')
    : null
  const endsAt = timing.meeting ? cairoInstant(timing.meeting.date, timing.meeting.end_time) : null
  const Icon = TYPE_ICONS[event.event_type]
  const over = timing.status === 'past'
  if (!detail) {
    const lines = [
      timing.day
        ? format.dateTime(cairoNoon(timing.day), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: CAIRO,
            numberingSystem: numberingSystemOf(locale),
          })
        : t('dateSoon'),
    ]
    if (timing.meeting && startsAt && endsAt) {
      const clock = {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: CAIRO,
        numberingSystem: numberingSystemOf(locale),
        ...(locale === 'ar' ? { hour12: false } : {}),
      } as const
      lines.push(format.dateTimeRange(new Date(startsAt), new Date(endsAt), clock))
    }
    const details: PosterData['details'] = []
    if (venue?.name) {
      const map = locationUrl(venue.map_url)
      details.push(map ? { text: venue.name, href: map } : venue.name)
    }
    const online = locationUrl(event.online_url)
    if (online) details.push({ text: t('online'), href: online })
    const speakers = event.speakers
      ?.flatMap(({ person }) => (typeof person === 'object' ? [person.name] : []))
      .join(listSeparator(locale))
    return (
      <div className={`poster-frame ${styles.posterFrame}`}>
        <Poster
          poster={{
            id: `event-${event.id}`,
            href: detailPath('events', String(event.slug), locale),
            layout: 1,
            color: EVENT_POSTER_COLORS[event.event_type],
            label: types(event.event_type),
            title: event.title,
            credit: speakers || undefined,
            tag: {
              icon: <Icon aria-hidden className="poster-tag-icon" size={20} strokeWidth={1.75} />,
              text: types(event.event_type),
            },
            image: mediaImage(cover),
            meta: { lines, status: over ? t('ended') : undefined },
            details,
            action: t('viewEvent'),
          }}
        />
      </div>
    )
  }
  const typeBadge = (
    <span className={styles.type}>
      <Icon size={20} strokeWidth={1.75} aria-hidden />
      <span>{types(event.event_type)}</span>
    </span>
  )
  return (
    <header className={styles.detailHeader}>
      {typeBadge}
      <h1 className={`${readerStyles.readerTitle} article-title`} id="event-title" dir="auto">
        {event.title}
      </h1>
      {showFacts && (
        <div className={styles.detailFacts}>
          {timing.meeting && startsAt ? (
            <EventWhen startsAt={startsAt} endsAt={endsAt} over={over} />
          ) : (
            <div className={spaceStyles.eventWhen}>
              {timing.day ? (
                <time className={spaceStyles.eventDate} dateTime={timing.day}>
                  {format.dateTime(cairoNoon(timing.day), {
                    dateStyle: 'long',
                    timeZone: CAIRO,
                  })}
                </time>
              ) : (
                <p className={spaceStyles.eventDate}>{t('dateSoon')}</p>
              )}
              {over && <span className={spaceStyles.eventTime}>{t('ended')}</span>}
            </div>
          )}
          {venue?.name && <EventPlace location={venue.map_url || venue.name} place={venue.name} />}
          {event.online_url && <EventPlace location={event.online_url} place={t('online')} />}
          {venue?.address && <p className={spaceStyles.eventNote}>{venue.address}</p>}
        </div>
      )}
    </header>
  )
}
