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
import { EventFace, EventPlace, EventWhen } from '@/components/space/event-details'
import { cairoInstant } from '@/lib/cairo-day'
import { publicEventCoverTone } from '@/lib/public-event-cover'
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
}: {
  event: Event
  now: Date
  detail?: boolean
}) {
  const [t, types, format, locale] = await Promise.all([
    getTranslations('Events'),
    getTranslations('Calendar.eventTypes'),
    getFormatter(),
    getLocale(),
  ])
  const timing = eventTiming(event, now)
  const cover = typeof event.cover_image === 'object' ? event.cover_image : null
  const coverUrl = cover?.sizes?.card?.url || cover?.url
  const tone = coverUrl ? await publicEventCoverTone(coverUrl) : null
  const place = typeof event.place === 'object' ? event.place : null
  const venue = event.external_venue?.name ? event.external_venue : place
  const startsAt = timing.day
    ? cairoInstant(timing.day, timing.meeting?.start_time ?? '12:00')
    : null
  const endsAt = timing.meeting ? cairoInstant(timing.meeting.date, timing.meeting.end_time) : null
  const Icon = TYPE_ICONS[event.event_type]
  const over = timing.status === 'past'
  return (
    <EventFace
      className={`${styles.publicCard} ${detail ? styles.hero : ''}`}
      title={event.title}
      titleHref={detail ? undefined : `/${locale}/events/${event.slug}`}
      headingLevel={detail ? 1 : 3}
      cover={coverUrl ? { url: coverUrl, tone, alt: cover?.alt } : null}
      startsAt={startsAt}
      over={over}
      label={event.title}
      corner={
        <span className={styles.type}>
          <Icon size={20} strokeWidth={1.75} aria-hidden />
          <span>{types(event.event_type)}</span>
        </span>
      }
      when={
        timing.meeting && startsAt ? (
          <EventWhen startsAt={startsAt} endsAt={endsAt} over={over} />
        ) : (
          <div className={spaceStyles.eventWhen}>
            {timing.day ? (
              <time className={spaceStyles.eventDate} dateTime={timing.day}>
                {format.dateTime(new Date(`${timing.day}T12:00:00Z`), {
                  dateStyle: 'long',
                  timeZone: 'Africa/Cairo',
                })}
              </time>
            ) : (
              <p className={spaceStyles.eventDate}>{t('dateSoon')}</p>
            )}
            {over && <span className={spaceStyles.eventTime}>{t('ended')}</span>}
          </div>
        )
      }
      where={
        <>
          {venue?.name && <EventPlace location={venue.map_url || venue.name} place={venue.name} />}
          {event.online_url && <EventPlace location={event.online_url} place={t('online')} />}
        </>
      }
      note={
        detail && venue?.address ? (
          <p className={spaceStyles.eventNote}>{venue.address}</p>
        ) : undefined
      }
    />
  )
}
