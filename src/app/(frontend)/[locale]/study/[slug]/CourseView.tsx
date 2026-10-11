import { useFormatter, useTranslations } from 'next-intl'
import React from 'react'

import { RichTextField } from '@/components/RichTextField'
import { priceLabel, pricingFor } from '@/lib/pricing'
import { registrationStatus } from '@/lib/registration'
import { expandSchedule, sessionsInOrder, type Meeting } from '@/lib/schedule'
import type { Course } from '@/payload-types'

/**
 * Presentational view of a single course.
 *
 * Knows nothing about the admin, live preview or draft mode — it renders the
 * course it is given. That keeps the markup reusable by the public page, the
 * live-preview iframe, and anything else that needs to show a course, and it
 * means the preview wiring in `CourseLivePreview` stays a few lines rather than
 * growing around the whole page.
 */
export const CourseView: React.FC<{ course: Course }> = ({ course }) => {
  const cover =
    course.cover_image && typeof course.cover_image === 'object' ? course.cover_image : null
  const cycle = course.cycle && typeof course.cycle === 'object' ? course.cycle : null
  const cycleLabel = cycle?.title ?? null
  const sessions = sessionsInOrder(course.sessions ?? [])
  const meetings = expandSchedule(course.schedule, course.sessions)
  const firstMeeting = meetings.find((m) => !m.cancelled)
  const price = priceLabel(pricingFor(course, cycle))
  const registration = registrationStatus(course.registration, cycle?.registration)
  const t = useTranslations('Course')
  const format = useFormatter()
  const unitLabel = (n: number) => (course.session_unit === 'week' ? t('week', { number: n }) : t('session', { number: n }))
  /** "Tue 3 Mar". Days are Cairo calendar days, so format them in UTC. */
  const dayLabel = (day: string): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      numberingSystem: 'latn',
    })
  /** "Tue 3 Mar, 18:00–20:30" */
  const meetingLabel = (m: Meeting): string => `${dayLabel(m.date)}, ${m.start_time}–${m.end_time}`

  return (
    <article className="mx-auto w-full max-w-4xl py-16">
      <header>
        <p className="text-xs tracking-widest uppercase opacity-50">{course.course_type}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">{course.title}</h1>
        {course.subtitle && <p className="mt-2 text-lg opacity-70">{course.subtitle}</p>}
        {course.epigraph && (
          <blockquote className="mt-6 border-s-2 ps-4 italic opacity-70">
            {course.epigraph}
          </blockquote>
        )}
      </header>

      {cover?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={cover.alt} className="mt-8 w-full" src={cover.url} />
      )}

      {course.description ? (
        <div className="mt-8">
          <RichTextField data={course.description} />
        </div>
      ) : null}

      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {course.location?.length ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">{t('location')}</dt>
            <dd>{course.location.join(', ').toLowerCase()}</dd>
          </>
        ) : null}
        {cycleLabel ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">{t('cycle')}</dt>
            <dd>{cycleLabel}</dd>
          </>
        ) : null}
        {firstMeeting ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">{t('starts')}</dt>
            <dd>
              {course.schedule?.start_precision === 'week'
                ? t('weekOf', { date: dayLabel(firstMeeting.date) })
                : dayLabel(firstMeeting.date)}
            </dd>
          </>
        ) : null}
        {price ? (
          <>
            <dt className="text-xs tracking-widest uppercase opacity-50">{t('price')}</dt>
            <dd>
              {price}
              {pricingFor(course, cycle)?.need_based_deductions
                ? ' — need-based deductions available'
                : ''}
            </dd>
          </>
        ) : null}
        <dt className="text-xs tracking-widest uppercase opacity-50">{t('registration')}</dt>
        <dd>{registration === 'open' ? t('open') : t('closed')}</dd>
      </dl>

      {course.bibliography?.length ? (
        <Section title={t('bibliography')}>
          <ul className="list-disc ps-5">
            {course.bibliography.map((item, i) =>
              item?.title ? <li key={item.id ?? i}>{renderEntry(item)}</li> : null,
            )}
          </ul>
        </Section>
      ) : null}

      {sessions.length ? (
        <Section title={t('sessions')}>
          <ol className="space-y-4">
            {sessions.map((session, i) => {
              const own = meetings.filter((m) => m.session === i + 1)
              return (
                <li key={session.id ?? i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-medium">
                      {unitLabel(i + 1)}
                      {session.session_title ? ` · ${session.session_title}` : ''}
                      {session.cancelled ? ' (cancelled)' : ''}
                    </p>
                    {own.length ? (
                      <p className="text-sm opacity-60">{own.map(meetingLabel).join(', ')}</p>
                    ) : null}
                  </div>
                  {session.description ? (
                    <div className="opacity-70">
                      <RichTextField className="prose-sm" data={session.description} />
                    </div>
                  ) : null}
                  {session.bibliography?.length ? (
                    <ul className="mt-1 text-sm opacity-70">
                      {session.bibliography.map((material, j) => (
                        <li key={material.id ?? j}>{renderEntry(material)}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </Section>
      ) : null}
    </article>
  )
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10">
    <h2 className="text-xs tracking-widest uppercase opacity-50">{title}</h2>
    <div className="mt-3 space-y-3">{children}</div>
  </section>
)

type BibEntry = NonNullable<Course['bibliography']>[number]

/** `{ type: 'reading', title: 'X', note: 'Y' }` → “Reading — X (Y)” */
const renderEntry = (entry: BibEntry): string => {
  if (!entry) return ''
  const label = entry.type.charAt(0).toUpperCase() + entry.type.slice(1)
  const body = [entry.title, entry.note ? `(${entry.note})` : null].filter(Boolean).join(' ')
  return `${label} — ${body}`
}

