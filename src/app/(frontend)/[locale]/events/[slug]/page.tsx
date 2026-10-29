import config from '@payload-config'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'
import { cache } from 'react'
import type { Locale } from '@/api/articles.api'
import { getPublicEvents } from '@/api/events.api'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { PublicEventCard } from '@/components/events/public-event-card'
import { EventAttendance } from '@/components/events/event-attendance'
import { EventDescription } from '@/components/events/event-description'
import { ShareBar } from '@/components/share-bar'
import { UpcomingEvents } from '@/components/events/upcoming-events'
import { PayloadForm } from '@/components/forms/payload-form'
import { Link } from '@/i18n/navigation'
import { localDigits } from '@/lib/digits'
import { eventTiming } from '@/lib/events'
import { expandSchedule } from '@/lib/schedule'
import { registrationStatus } from '@/lib/registration'
import { plainText } from '@/lib/plaintext'
import styles from '@/components/events/events.module.css'
import readerStyles from '@/components/arc/blocks/blog-grid/blog-grid.module.css'

type Props = { params: Promise<{ locale: Locale; slug: string }> }
export const revalidate = 60

const readEvent = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayload({ config })
  return (await getPublicEvents(payload, locale, slug))[0]
})

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params
  const event = await readEvent(locale, slug)
  if (!event) notFound()
  const cover = typeof event.cover_image === 'object' ? event.cover_image : null
  return {
    title: event.meta?.title || event.title,
    description:
      event.meta?.description ||
      (event.description ? plainText({ data: event.description }).slice(0, 160) : undefined),
    openGraph: { images: cover?.url ? [{ url: cover.url, alt: cover.alt || event.title }] : [] },
  }
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params
  const [event, t, format, share] = await Promise.all([
    readEvent(locale, slug),
    getTranslations('Events'),
    getFormatter(),
    getTranslations('Share'),
  ])
  if (!event) notFound()
  const now = new Date()
  const timing = eventTiming(event, now)
  const form = typeof event.registration?.form === 'object' ? event.registration.form : null
  const open =
    timing.status !== 'past' && registrationStatus(event.registration, null, now) === 'open'
  const meetings = event.schedule?.start_precision === 'week' ? [] : expandSchedule(event.schedule)
  const date = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), { dateStyle: 'full', timeZone: 'Africa/Cairo' })
  const notes: Record<string, ReactNode> = {}
  for (const block of form?.fields ?? [])
    if (block.blockType === 'message' && block.message && block.id)
      notes[block.id] = <RichTextField data={block.message} />
  return (
    <div className={readerStyles.root}>
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
          <div className={styles.detailBody}>
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
            {!!event.speakers?.length && (
              <section className={styles.section}>
                <h2>{t('speakers')}</h2>
                <ul>
                  {event.speakers.map((speaker, i) => {
                    const person = typeof speaker.person === 'object' ? speaker.person : null
                    return person ? (
                      <li key={speaker.id || i}>
                        <Link className="home-more" href={`/people/${person.slug}`}>
                          {person.name}
                        </Link>
                        {speaker.role ? ` · ${speaker.role}` : ''}
                      </li>
                    ) : null
                  })}
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
