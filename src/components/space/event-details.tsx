import type { DateTimeFormatOptions } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import type { CSSProperties, ReactNode } from 'react'
import { CalendarDays, MapPin, Video } from 'lucide-react'

import { Badge } from '@/components/arc/badge/badge'
import { CAIRO, cairoDay } from '@/lib/cairo-day'
import { coverField } from '@/lib/event-cover'
import { meetingService, placeHost } from '@/lib/event-place'
import { googleCalendarUrl, locationUrl } from '@/lib/space-event'
import { absoluteUrl } from '@/lib/schema'
import type { RsvpView } from '@/lib/spaces-data'

import { EventAnswers } from './event-answers'
import { EventCalendar } from './event-calendar'
import type { PersonCard } from './person-hover'
import styles from './space.module.css'

/** The image and optional colour shared by public and Spaces event cards. */
export type EventCover = { url: string; tone: string | null; alt?: string }

/**
 * The day and time of an event in Cairo time (ADR 0002), as two quiet lines:
 * the day (with the year only when it is not this year), then the time or
 * range and the zone. An end on another day reads "until …".
 */
export async function EventWhen({
  startsAt,
  endsAt,
  over,
}: {
  startsAt: string
  endsAt: string | null
  over: boolean
}) {
  const [t, format, locale] = await Promise.all([
    getTranslations('SpacePost'),
    getFormatter(),
    getLocale(),
  ])
  const date = new Date(startsAt)
  const sameDay = !endsAt || cairoDay(endsAt) === cairoDay(startsAt)
  const thisYear =
    cairoDay(startsAt)?.slice(0, 4) === cairoDay(new Date().toISOString())?.slice(0, 4)
  // Arabic reads 24-hour times (as the composer's picker shows them), each side of a range
  // set left to right so the digits do not swap places.
  const arabic = locale === 'ar'
  const clock: DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: CAIRO,
    ...(arabic ? { hour12: false } : {}),
  }
  const time =
    endsAt && sameDay ? (
      arabic ? (
        <bdi dir="ltr">
          {format.dateTime(date, clock)}–{format.dateTime(new Date(endsAt), clock)}
        </bdi>
      ) : (
        format.dateTimeRange(date, new Date(endsAt), clock)
      )
    ) : (
      format.dateTime(date, clock)
    )
  return (
    <div className={styles.eventWhen}>
      <time dateTime={startsAt} className={styles.eventDate}>
        {format.dateTime(date, {
          timeZone: CAIRO,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          ...(thisYear ? {} : { year: 'numeric' }),
        })}
      </time>
      <span className={styles.eventTime}>
        <span>{time}</span>
        {endsAt && !sameDay && (
          <time dateTime={endsAt}>
            {t('eventUntil', {
              when: format.dateTime(new Date(endsAt), {
                timeZone: CAIRO,
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                ...clock,
              }),
            })}
          </time>
        )}
        <span className={styles.eventZone}>{t('cairoTime')}</span>
        {over && (
          <Badge size="sm" tone="neutral">
            {t('eventEnded')}
          </Badge>
        )}
      </span>
    </div>
  )
}

/**
 * Where an event is. A web address reads as what it opens: the meeting
 * service, the place name read when the event was saved, or the host.
 */
export async function EventPlace({ location, place }: { location: string; place: string | null }) {
  const t = await getTranslations('SpacePost')
  const url = locationUrl(location)
  const service = url ? meetingService(url) : null
  const Icon = service ? Video : MapPin
  const name = !url
    ? location
    : service
      ? `${t(service === 'zoom' ? 'placeZoom' : service === 'meet' ? 'placeMeet' : 'placeTeams')}`
      : (place ?? placeHost(url))
  return (
    <p className={styles.eventWhere}>
      <Icon size={16} aria-hidden="true" />
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.eventLink}>
          <bdi>{name}</bdi>
        </a>
      ) : (
        <bdi>{name}</bdi>
      )}
    </p>
  )
}

/**
 * The face every event card shares. With a cover, the photo fills the top
 * and dissolves into a field made from its own colour, which carries the
 * details in light text (the one place Spaces uses a gradient and blur, at
 * the members' request). Without one, the same layout sits on a quiet tonal
 * surface with a calendar leaf where the photo would be.
 */
export async function EventFace({
  title,
  titleHref,
  headingLevel = 3,
  cover,
  startsAt,
  over,
  label,
  when,
  where,
  note,
  badge,
  children,
  description,
  corner,
  className,
  layout,
}: {
  title: string
  /** In the Events tab the name opens the post */
  titleHref?: string
  headingLevel?: 1 | 2 | 3
  cover: EventCover | null
  startsAt: string | null
  over: boolean
  label: string
  when: ReactNode
  where: ReactNode
  /** A quiet line under the place, such as who started it */
  note?: ReactNode
  badge?: ReactNode
  children?: ReactNode
  /** The event's own words, under the answers */
  description?: ReactNode
  /** One quiet control in the card's top corner */
  corner?: ReactNode
  className?: string
  layout?: 'card'
}) {
  const [t, format] = await Promise.all([getTranslations('SpacePost'), getFormatter()])
  const Heading = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3'
  const leaf = (date: string, options: DateTimeFormatOptions) =>
    format.dateTime(new Date(date), { timeZone: CAIRO, ...options })
  return (
    <section
      className={[styles.event, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-layout={layout}
      data-cover={cover ? '' : undefined}
      data-over={over || undefined}
      style={cover ? ({ '--event-field': coverField(cover.tone) } as CSSProperties) : undefined}
    >
      {cover ? (
        <div className={styles.eventBackdrop}>
          {/* Private files come from Payload's own route, which next/image cannot read with the member's session; the server stores covers at most 1600 px wide. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.eventBlur} src={cover.url} alt="" decoding="async" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.eventPhoto}
            src={cover.url}
            alt={cover.alt ?? t('eventCoverAlt', { title })}
            decoding="async"
          />
        </div>
      ) : startsAt ? (
        <time dateTime={startsAt} className={styles.eventLeaf} aria-hidden="true">
          <span className={styles.eventMonth}>{leaf(startsAt, { month: 'short' })}</span>
          <span className={styles.eventDay}>{leaf(startsAt, { day: 'numeric' })}</span>
        </time>
      ) : (
        <div className={styles.eventLeaf} aria-hidden="true">
          <CalendarDays size={32} strokeWidth={1.5} />
        </div>
      )}
      <div className={styles.eventBody}>
        <div className={styles.eventHead}>
          {badge}
          <Heading
            className={styles.eventTitle}
            dir="auto"
            title={layout === 'card' ? title : undefined}
          >
            {titleHref ? (
              <a href={titleHref} className={styles.eventTitleLink}>
                {title}
              </a>
            ) : (
              title
            )}
          </Heading>
          <div className={styles.eventFacts}>
            {when}
            {where}
            {note}
          </div>
        </div>
        {children}
        {description}
      </div>
      {corner && <div className={styles.eventCorner}>{corner}</div>}
    </section>
  )
}

export type EventDetailsProps = {
  post: number
  title: string
  titleHref?: string
  headingLevel?: 2 | 3
  startsAt: string
  endsAt: string | null
  location: string
  /** The place name read on save, for a web address */
  place: string | null
  cover: EventCover | null
  rsvp: RsvpView | null
  /** The event has ended, as of when the page rendered */
  over: boolean
  /** Locked or archived: the answers can no longer change */
  closed: boolean
  /** The post's own page, for the calendar entry */
  href: string
  note?: ReactNode
  description?: ReactNode
  people?: Map<number, PersonCard>
  /** The reader's own face for the going list */
  me: { personId: number | null; name: string; photo: string | null }
}

/**
 * An event post's card: its name, when and where, the member's answer and who
 * is going, and a calendar button in the corner. One layout for the feed, the
 * post page and the Events tab; changing the event is in the post's menu.
 */
export async function EventDetails({
  post,
  title,
  titleHref,
  headingLevel,
  startsAt,
  endsAt,
  location,
  place,
  cover,
  rsvp,
  over,
  closed,
  href,
  note,
  description,
  people,
  me,
}: EventDetailsProps) {
  const [t, locale] = await Promise.all([getTranslations('SpacePost'), getLocale()])
  return (
    <EventFace
      title={title}
      titleHref={titleHref}
      headingLevel={headingLevel}
      cover={cover}
      startsAt={startsAt}
      over={over}
      label={t('eventLabel')}
      when={<EventWhen startsAt={startsAt} endsAt={endsAt} over={over} />}
      where={<EventPlace location={location} place={place} />}
      note={note}
      description={description}
      corner={
        <EventCalendar
          google={googleCalendarUrl({
            title,
            startsAt,
            endsAt,
            location,
            details: absoluteUrl(href),
          })}
          ics={`/api/space-events/${post}?locale=${locale}`}
        />
      }
    >
      {rsvp && (
        <EventAnswers
          post={post}
          rsvp={rsvp}
          readOnly={over || closed}
          me={
            me.personId !== null ? { personId: me.personId, name: me.name, photo: me.photo } : null
          }
          people={people}
        />
      )}
    </EventFace>
  )
}
