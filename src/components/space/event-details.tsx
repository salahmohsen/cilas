import type { DateTimeFormatOptions } from 'next-intl'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { Clock, MapPin } from 'lucide-react'

import { Badge } from '@/components/arc/badge/badge'
import { CAIRO, cairoDay, cairoTime } from '@/lib/cairo-day'
import { eventTitle, googleCalendarUrl, locationUrl } from '@/lib/space-event'
import { absoluteUrl } from '@/lib/schema'
import type { RsvpView } from '@/lib/spaces-data'

import { EventAnswers } from './event-answers'
import { EventCalendar } from './event-calendar'
import { EventEdit } from './event-edit'
import { LinkPreviews } from './link-card'
import type { PersonCard } from './person-hover'
import styles from './space.module.css'

export type EventDetailsProps = {
  post: number
  body: string
  startsAt: string
  endsAt: string | null
  location: string
  rsvp: RsvpView | null
  /** The event has ended, as of when the page rendered */
  over: boolean
  /** Locked or archived: the answers can no longer change */
  closed: boolean
  /** The author or a moderator */
  canChange: boolean
  /** The post's own page, for the calendar entry */
  href: string
  people?: Map<number, PersonCard>
  /** The reader's own face for the going list */
  me: { personId: number | null; name: string; photo: string | null }
}

/**
 * An event post's card, in Cairo time (ADR 0002): a calendar leaf beside when
 * and where (a web address shows its link preview), then the member's answer
 * and who is going. One layout for the feed, the post page and the Events tab.
 */
export async function EventDetails({
  post,
  body,
  startsAt,
  endsAt,
  location,
  rsvp,
  over,
  closed,
  canChange,
  href,
  people,
  me,
}: EventDetailsProps) {
  const [t, format, locale] = await Promise.all([
    getTranslations('SpacePost'),
    getFormatter(),
    getLocale(),
  ])
  const date = new Date(startsAt)
  const part = (options: DateTimeFormatOptions) =>
    format.dateTime(date, { timeZone: CAIRO, ...options })
  const sameDay = !endsAt || cairoDay(endsAt) === cairoDay(startsAt)
  // Arabic reads 24-hour times (as the composer's picker shows them), each side of a range
  // set left to right so the digits do not swap places.
  const arabic = locale === 'ar'
  const clock: DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: CAIRO,
    ...(arabic ? { hour12: false } : {}),
  }
  const url = locationUrl(location)
  const title = eventTitle(body, t('eventLabel'))
  const readOnly = over || closed
  return (
    <section className={styles.event} aria-label={t('eventLabel')} data-over={over || undefined}>
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
              {endsAt && !sameDay && (
                <time dateTime={endsAt} className={styles.meta}>
                  {t('eventUntil', {
                    when: format.dateTime(new Date(endsAt), {
                      timeZone: CAIRO,
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    }),
                  })}
                </time>
              )}
              <span className={styles.meta}>{t('cairoTime')}</span>
              {over && (
                <Badge size="sm" tone="neutral">
                  {t('eventEnded')}
                </Badge>
              )}
            </span>
          </p>
          <p className={styles.eventWhere}>
            <MapPin size={15} aria-hidden="true" />
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className={styles.eventLink}>
                <bdi>{url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</bdi>
              </a>
            ) : (
              <bdi>{location}</bdi>
            )}
          </p>
        </div>
        <div className={styles.eventTools}>
          {canChange && !over && !closed && (
            <EventEdit
              post={post}
              initial={{
                location,
                day: cairoDay(startsAt) ?? '',
                time: cairoTime(startsAt) ?? '18:00',
                endTime: endsAt && sameDay ? cairoTime(endsAt) : null,
              }}
            />
          )}
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
        </div>
      </div>
      {url && (
        <Suspense fallback={null}>
          <LinkPreviews urls={[url]} compact />
        </Suspense>
      )}
      {rsvp && (
        <EventAnswers
          post={post}
          rsvp={rsvp}
          readOnly={readOnly}
          me={
            me.personId !== null ? { personId: me.personId, name: me.name, photo: me.photo } : null
          }
          people={people}
        />
      )}
    </section>
  )
}
