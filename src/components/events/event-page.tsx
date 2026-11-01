import { ArrowLeft } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import type { Locale } from '@/api/articles.api'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { PublicEventCard } from '@/components/events/public-event-card'
import { EventAttendance } from '@/components/events/event-attendance'
import { EventDescription } from '@/components/events/event-description'
import { ShareBar } from '@/components/share-bar'
import { PROFILE_COLORS, ProfileCard } from '@/components/person/profile-card'
import { RichTextField as PlainRichText } from '@/components/RichTextField'
import { UpcomingEvents } from '@/components/events/upcoming-events'
import { PayloadForm } from '@/components/forms/payload-form'
import { Link } from '@/i18n/navigation'
import { localDigits } from '@/lib/digits'
import { eventTiming } from '@/lib/events'
import { expandSchedule } from '@/lib/schedule'
import { registrationStatus } from '@/lib/registration'
import { breadcrumbSchema, eventSchema } from '@/lib/schema'
import { Schema } from '@/components/schema'
import styles from '@/components/events/events.module.css'
import readerStyles from '@/components/arc/blocks/blog-grid/blog-grid.module.css'

import type { Event } from '@/payload-types'
import { RefreshRouteOnSave } from '@/components/RefreshRouteOnSave'

export async function EventPage({
  event,
  locale,
  preview = false,
}: {
  event: Event
  locale: Locale
  preview?: boolean
}) {
  const [t, format, share, tm] = await Promise.all([
    getTranslations('Events'),
    getFormatter(),
    getTranslations('Share'),
    getTranslations('Meta'),
  ])
  const schema = eventSchema({ event, locale, siteName: tm('siteName') })
  const crumbs = breadcrumbSchema([
    { name: tm('siteName'), path: `/${locale}` },
    { name: t('title'), path: `/${locale}/events` },
    { name: event.title, path: `/${locale}/events/${event.slug}` },
  ])
  const now = new Date()
  const timing = eventTiming(event, now)
  const form = typeof event.registration?.form === 'object' ? event.registration.form : null
  const open =
    timing.status !== 'past' && registrationStatus(event.registration, null, now) === 'open'
  const meetings = event.schedule?.start_precision === 'week' ? [] : expandSchedule(event.schedule)
  const date = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), { dateStyle: 'full', timeZone: 'Africa/Cairo' })
  const speakers = (event.speakers ?? []).flatMap((speaker, i) =>
    typeof speaker.person === 'object' && speaker.person?.slug
      ? [{ person: speaker.person, role: speaker.role, key: speaker.id || String(i) }]
      : [],
  )
  const notes: Record<string, ReactNode> = {}
  for (const block of form?.fields ?? [])
    if (block.blockType === 'message' && block.message && block.id)
      notes[block.id] = <RichTextField data={block.message} />
  return (
    <div className={readerStyles.root}>
      {preview ? <RefreshRouteOnSave /> : null}
      <Schema data={schema ? [schema, crumbs] : [crumbs]} />
      <div className={readerStyles.inner}>
        <article className={styles.detailLayout} aria-labelledby="event-title">
          <div className={styles.detailBack}>
            <Link className={readerStyles.back} href="/events">
              <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
              {t('all')}
            </Link>
          </div>
          <div className={styles.detailHeading}>
            <PublicEventCard event={event} now={now} detail showFacts={false} />
          </div>
          <EventAttendance event={event} now={now} locale={locale} />
          <div className={`${styles.detailBody} prose-frame`}>
            {meetings.length > 1 && (
              <div className={styles.details}>
                <ul className={styles.agenda}>
                  {meetings.map((m) => (
                    <li key={`${m.date}-${m.start_time}`}>
                      <time dateTime={m.date}>{date(m.date)}</time> ·{' '}
                      <bdi>{localDigits(`${m.start_time}–${m.end_time}`, locale)}</bdi> ·{' '}
                      {t('cairoTime')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {event.description && <EventDescription data={event.description} />}
            {speakers.length > 0 && (
              <section className={styles.section}>
                <h2>{t('speakers')}</h2>
                {/* One card a row; neighbours never share a colour. */}
                <ul className={styles.speakers}>
                  {speakers.map(({ person, role, key }, i) => (
                    <li key={key}>
                      <ProfileCard color={PROFILE_COLORS[i % 3]} person={person} role={role}>
                        {person.bio && (
                          <PlainRichText
                            className="article-prose article-prose--bio"
                            data={person.bio}
                            plain
                          />
                        )}
                      </ProfileCard>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {!!event.agenda?.length && (
              <section className={styles.section}>
                <h2>{t('agenda')}</h2>
                <ul className={styles.agenda}>
                  {event.agenda.map((item, i) => (
                    <li key={item.id || i}>
                      <bdi>{localDigits(`${item.start_time}–${item.end_time}`, locale)}</bdi> ·{' '}
                      {item.title}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {open && event.registration?.method === 'form' && form && (
              <section className={styles.section} id="event-registration">
                <h2>{t('register')}</h2>
                <PayloadForm
                  disabled={preview}
                  form={form}
                  notes={notes}
                  confirmation={
                    form.confirmationMessage ? (
                      <RichTextField data={form.confirmationMessage} />
                    ) : null
                  }
                  back={{ href: '/events', label: t('all') }}
                />
              </section>
            )}
            <section className={styles.share} aria-labelledby="event-share">
              <h2 id="event-share">{share('heading')}</h2>
              <div className={styles.shareActions}>
                <ShareBar
                  path={`/${locale}/events/${event.slug}`}
                  title={event.title}
                  label={share('event')}
                />
              </div>
            </section>
          </div>
        </article>
      </div>
      <UpcomingEvents currentId={event.id} locale={locale} now={now} />
    </div>
  )
}
