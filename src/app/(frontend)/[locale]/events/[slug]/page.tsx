import config from '@payload-config'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'
import { cache } from 'react'
import type { Locale } from '@/api/articles.api'
import { getPublicEvents } from '@/api/events.api'
import { RichTextField } from '@/components/RichTextField'
import { Badge } from '@/components/arc/badge/badge'
import { PayloadForm } from '@/components/forms/payload-form'
import { Link } from '@/i18n/navigation'
import { localDigits } from '@/lib/digits'
import { eventTiming } from '@/lib/events'
import { expandSchedule } from '@/lib/schedule'
import { registrationStatus } from '@/lib/registration'
import { plainText } from '@/lib/plaintext'
import styles from '@/components/events/events.module.css'

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
  const [event, t, types, format] = await Promise.all([
    readEvent(locale, slug),
    getTranslations('Events'),
    getTranslations('Calendar.eventTypes'),
    getFormatter(),
  ])
  if (!event) notFound()
  const now = new Date()
  const timing = eventTiming(event, now)
  const cover = typeof event.cover_image === 'object' ? event.cover_image : null
  const place = typeof event.place === 'object' ? event.place : null
  const where = event.external_venue?.name || place?.name
  const address = event.external_venue?.address || place?.address
  const map = event.external_venue?.map_url || place?.map_url
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
    <article className={styles.page}>
      <header className={styles.header}>
        <Link className="home-more" href="/events">
          {t('all')}
        </Link>
        <p>{types(event.event_type)}</p>
        <h1>{event.title}</h1>
        {timing.status === 'past' && <Badge>{t('ended')}</Badge>}
      </header>
      {cover?.url && (
        <Image
          className={styles.cover}
          src={cover.url}
          alt={cover.alt || ''}
          width={1180}
          height={786}
          sizes="(max-width: 1180px) 100vw, 1180px"
        />
      )}
      <div className={styles.details}>
        {meetings.length ? (
          <ul className={styles.agenda}>
            {meetings.map((m) => (
              <li key={`${m.date}-${m.start_time}`}>
                <time dateTime={m.date}>{date(m.date)}</time> ·{' '}
                <bdi>{localDigits(`${m.start_time}–${m.end_time}`, locale)}</bdi> · {t('cairoTime')}
              </li>
            ))}
          </ul>
        ) : (
          <p>{timing.day ? date(timing.day) : t('dateSoon')}</p>
        )}
        {event.schedule?.note && <p>{event.schedule.note}</p>}
        {where && (
          <p>
            {map ? (
              <a className="home-more" href={map} rel="noopener noreferrer" target="_blank">
                {where}
              </a>
            ) : (
              where
            )}
            {address ? ` · ${address}` : ''}
          </p>
        )}
        {event.online_url && (
          <a
            className="home-more"
            href={event.online_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('joinOnline')}
          </a>
        )}
        {event.pricing?.min != null && (
          <p>
            {event.pricing.min === 0 && !event.pricing.max
              ? t('free')
              : `${format.number(event.pricing.min)}${event.pricing.max ? `–${format.number(event.pricing.max)}` : ''} ${t('egp')}`}
          </p>
        )}
        {event.pricing?.note && <p>{event.pricing.note}</p>}
      </div>
      {event.description && <RichTextField data={event.description} className="article-prose" />}
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
      {open && event.registration?.method === 'external' && event.registration.url && (
        <a
          className="home-more"
          href={event.registration.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {t('register')}
        </a>
      )}
      {open && event.registration?.method === 'form' && form && (
        <section className={styles.section}>
          <h2>{t('register')}</h2>
          <PayloadForm
            form={form}
            notes={notes}
            confirmation={
              form.confirmationMessage ? <RichTextField data={form.confirmationMessage} /> : null
            }
            back={{ href: '/events', label: t('all') }}
          />
        </section>
      )}
      {!open && event.registration?.method && <p>{t('registrationClosed')}</p>}
    </article>
  )
}
