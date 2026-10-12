import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clapperboard,
  Clock,
  Flower2,
  Headphones,
  Languages,
  Leaf,
  Link2,
  ListOrdered,
  MapPin,
  MessageCircleQuestion,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import React from 'react'

import { ContributorList } from '@/components/person/contributors'
import { RichTextField } from '@/components/RichTextField'
import { Link } from '@/i18n/navigation'
import { weekdayOf as cairoWeekday } from '@/lib/cairo-day'
import type { Season } from '@/lib/cycle'
import { priceLabel, pricingFor } from '@/lib/pricing'
import { registrationStatus } from '@/lib/registration'
import { expandSchedule, sessionsInOrder, type Meeting } from '@/lib/schedule'
import type { Course, Media, Person, Space } from '@/payload-types'

/** A course in the same cycle, as the end of the page lists it. */
export type RelatedCourse = {
  id: number
  slug: string
  title: string
  type: Course['course_type']
  fellows: string[]
  image?: { url: string; alt: string }
}

type Material = NonNullable<Course['bibliography']>[number]
type MaterialType = Material['type']

/** A season's mark: the one picture the page gives a cycle. */
export const SEASON_ICONS: Record<Season, LucideIcon> = {
  spring: Flower2,
  summer: Sun,
  fall: Leaf,
  winter: Snowflake,
}

/** What kind of thing a material is: read, watched, listened to, answered, or followed. */
export const MATERIAL_ICONS: Record<MaterialType, LucideIcon> = {
  reading: BookOpen,
  watch: Clapperboard,
  listen: Headphones,
  prompt: MessageCircleQuestion,
  other: Link2,
}
const MATERIAL_ORDER: MaterialType[] = ['reading', 'watch', 'listen', 'prompt', 'other']

const isObject = <T,>(v: unknown): v is T => typeof v === 'object' && v !== null

/** Every text in a rich-text tree, joined. */
const textOf = (node: unknown): string => {
  if (!isObject<{ text?: unknown; children?: unknown[]; root?: unknown }>(node)) return ''
  if (node.root) return textOf(node.root)
  return [typeof node.text === 'string' ? node.text : '', ...(node.children ?? []).map(textOf)].join(' ')
}

/** The direction a course's own text reads in: it may be in the other language than the page. */
const directionOf = (text: string): 'rtl' | 'ltr' => {
  const arabic = (text.match(/[\u0600-\u06ff]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  return arabic >= latin ? 'rtl' : 'ltr'
}

/** How many courses of the cycle the end of the page shows. */
const RELATED_SHOWN = 6

/**
 * One course: what it is, who teaches it, when it meets, and its flow
 * session by session. The facts sit in a sidebar beside the text on wide
 * screens and under the title on narrow ones.
 *
 * Knows nothing about the admin, live preview or draft mode — it renders the
 * course it is given, so the public page and the live-preview iframe share it.
 */
export const CourseView: React.FC<{ course: Course; related?: RelatedCourse[] }> = ({ course, related = [] }) => {
  const t = useTranslations('Course')
  const tf = useTranslations('Study.filters')
  const format = useFormatter()
  const locale = useLocale()

  const cover = isObject<Media>(course.cover_image) && course.cover_image.url ? course.cover_image : null
  const cycle = isObject<NonNullable<Course['cycle']> & object>(course.cycle) ? course.cycle : null
  const space = cycle && isObject<Space>(cycle.space) ? cycle.space : null
  const season = (cycle?.season ?? null) as Season | null
  const SeasonIcon = season ? SEASON_ICONS[season] : null
  const cycleLabel = cycle
    ? [`${tf(`seasons.${season}`)} ${cycle.start_year}`, space?.city ?? space?.name].filter(Boolean).join(locale === 'ar' ? '، ' : ', ')
    : null
  const typeLabel = tf(`types.${course.course_type.toLowerCase()}`)
  const fellows = (course.fellows ?? []).filter(isObject<Person>)
  const dir = directionOf(`${course.title} ${course.subtitle ?? ''} ${textOf(course.description)}`)
  const lang = dir === 'rtl' ? 'ar' : 'en'

  const sessions = sessionsInOrder(course.sessions ?? [])
  const meetings = expandSchedule(course.schedule, course.sessions)
  const firstMeeting = meetings.find((m) => !m.cancelled)
  const price = priceLabel(pricingFor(course, cycle))
  const open = registrationStatus(course.registration, cycle?.registration) === 'open'
  const applyUrl = open ? (course.registration?.url ?? null) : null

  /** "Tue 3 Mar". Days are Cairo calendar days, so format them in UTC. */
  const dayLabel = (day: string, weekday: 'short' | 'long' = 'short'): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      weekday,
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      numberingSystem: 'latn',
    })
  const weekdayName = (day: string): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), { weekday: 'long', timeZone: 'UTC' })
  const meetingLabel = (m: Meeting): string => `${dayLabel(m.date)}, ${m.start_time}–${m.end_time}`
  const unitLabel = (n: number) =>
    course.session_unit === 'week' ? t('week', { number: n }) : t('session', { number: n })

  // Every material, for the sidebar's count by kind.
  const allMaterials = [...sessions.flatMap((s) => s.bibliography ?? []), ...(course.bibliography ?? [])]
  const counts = MATERIAL_ORDER.map((type) => ({ type, count: allMaterials.filter((m) => m.type === type).length })).filter(
    (c) => c.count > 0,
  )

  // The weekly meeting time, from the first meeting of each slot.
  const slots = (course.schedule?.slots ?? []).flatMap((slot) => {
    const first = meetings.find((m) => !m.cancelled && cairoWeekday(m.date) === slot.weekday && m.start_time === slot.start_time)
    return first ? [`${weekdayName(first.date)}, ${slot.start_time}–${slot.end_time}`] : []
  })

  const facts: Array<{ icon: LucideIcon; label: string; value: React.ReactNode }> = [
    ...(cycleLabel && SeasonIcon ? [{ icon: SeasonIcon, label: t('cycle'), value: cycleLabel }] : []),
    ...(firstMeeting
      ? [
          {
            icon: CalendarDays,
            label: t('starts'),
            value:
              course.schedule?.start_precision === 'week'
                ? t('weekOf', { date: dayLabel(firstMeeting.date) })
                : dayLabel(firstMeeting.date, 'long'),
          },
        ]
      : []),
    ...(slots.length ? [{ icon: Clock, label: t('meets'), value: slots.join(' · ') }] : []),
    ...(sessions.length
      ? [
          {
            icon: ListOrdered,
            label: t('length'),
            value: course.session_unit === 'week' ? t('weeks', { count: sessions.length }) : t('sessions', { count: sessions.length }),
          },
        ]
      : []),
    ...(course.location?.length
      ? [
          {
            icon: MapPin,
            label: t('format'),
            value: course.location.map((l) => tf(`formats.${l.toLowerCase()}`)).join(' / '),
          },
        ]
      : []),
    ...(course.teaching_languages?.length || course.language_note
      ? [
          {
            icon: Languages,
            label: t('language'),
            value: course.language_note || course.teaching_languages!.map((l) => tf(`languages.${l}`)).join(' / '),
          },
        ]
      : []),
  ]

  const facultyCard = (
    <ContributorList
      contributors={fellows.map((person) => ({ person, role: t('fellow') }))}
      title={t('taughtBy')}
      titleClassName="mb-3 text-sm font-medium"
    />
  )

  const factsCard = (
    <section aria-label={t('details')} className="course-card">
      <div className="flex items-center justify-between gap-3">
        <span className="course-status" data-open={open || undefined}>
          {open ? t('open') : t('closed')}
        </span>
        {price ? <span className="text-sm text-(--text-secondary)">{price}</span> : null}
      </div>
      {applyUrl ? (
        <a className="course-apply" href={applyUrl} rel="noopener" target="_blank">
          {t('apply')}
        </a>
      ) : null}
      {facts.length ? (
        <dl className="mt-4 grid gap-3 border-t border-border pt-4">
          {facts.map(({ icon: Icon, label, value }) => (
            <div className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3" key={label}>
              <Icon aria-hidden className="mt-0.5 text-(--text-muted)" size={16} strokeWidth={1.5} />
              <div>
                <dt className="text-xs text-(--text-muted)">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )

  const materialsCard = counts.length ? (
    <section aria-labelledby="course-materials" className="course-card">
      <h2 className="text-sm font-medium" id="course-materials">
        {t('materials')}
      </h2>
      <ul className="mt-3 grid gap-2">
        {counts.map(({ type, count }) => {
          const Icon = MATERIAL_ICONS[type]
          return (
            <li className="flex items-center gap-3 text-sm" key={type}>
              <Icon aria-hidden className="text-(--text-muted)" size={16} strokeWidth={1.5} />
              {t(`materialCounts.${type}`, { count })}
            </li>
          )
        })}
      </ul>
    </section>
  ) : null

  return (
    <div className="course-page mx-auto w-full max-w-6xl px-0 py-10 sm:py-14">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <article aria-labelledby="course-title" className="min-w-0">
          <Link
            className="inline-flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
            href={`/study?type=${course.course_type.toLowerCase()}`}
          >
            <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
            {t(`backTo.${course.course_type.toLowerCase()}`)}
          </Link>

          <header className="mt-8">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--text-secondary)">
              {SeasonIcon ? <SeasonIcon aria-hidden className="course-season" data-season={season} size={16} strokeWidth={1.5} /> : null}
              {cycleLabel ? <span>{cycleLabel}</span> : null}
              <span aria-hidden="true">·</span>
              <span>{typeLabel}</span>
            </p>
            <h1 className="course-title mt-3" dir={dir} id="course-title" lang={lang}>
              {course.title}
            </h1>
            {course.subtitle ? (
              <p className="mt-3 text-lg text-(--text-secondary)" dir="auto">
                {course.subtitle}
              </p>
            ) : null}
          </header>

          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={cover.alt ?? ''} className="course-cover mt-8" src={cover.url} />
          ) : null}

          {/* Narrow screens: the facts and the fellows come before the text. */}
          <div className="mt-8 grid gap-4 lg:hidden">
            {factsCard}
            <div className="course-card">{facultyCard}</div>
          </div>

          {course.epigraph ? (
            <div className="article-prose mt-10">
              <blockquote>
                <p dir="auto">{course.epigraph}</p>
              </blockquote>
            </div>
          ) : null}

          {course.description ? (
            <section aria-labelledby="course-about" className="mt-10">
              <h2 className="course-heading" id="course-about">
                {t('about')}
              </h2>
              <div dir={dir} lang={lang}>
                <RichTextField className="article-prose mt-4" data={course.description} />
              </div>
            </section>
          ) : null}

          {course.facilitator_note ? (
            <section aria-labelledby="course-note" className="course-note mt-10">
              <h2 className="text-sm font-medium" id="course-note">
                {t('note')}
              </h2>
              <div className="mt-3 grid gap-3 text-[0.95rem] leading-relaxed" dir="auto">
                {course.facilitator_note.split(/\n\s*\n/).map((p, i) => (
                  <p className="whitespace-pre-line" key={i}>
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ) : null}

          {course.content_warning ? (
            <p className="mt-6 border-s-2 border-foreground ps-4 text-sm" role="note">
              <span className="font-medium">{t('contentWarning')}</span> {course.content_warning}
            </p>
          ) : null}

          {sessions.length ? (
            <section aria-labelledby="course-flow" className="mt-12">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="course-heading" id="course-flow">
                  {t('flow')}
                </h2>
                {course.syllabus_tentative ? (
                  <p className="text-sm text-[var(--text-muted)]">{t('tentative')}</p>
                ) : null}
              </div>
              <ol className="mt-4 grid gap-2">
                {sessions.map((session, i) => {
                  const own = meetings.filter((m) => m.session === i + 1)
                  const materials = session.bibliography ?? []
                  const activities = session.activities ?? []
                  const hasBody = Boolean(session.description || materials.length || activities.length)
                  return (
                    <li key={session.id ?? i}>
                      <details className="course-session" open={i === 0 && hasBody}>
                        <summary>
                          <span className="course-session-number">{String(i + 1).padStart(2, '0')}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium" dir="auto">
                              {session.session_title || unitLabel(i + 1)}
                              {session.cancelled ? ` (${t('cancelled')})` : ''}
                            </span>
                            <span className="mt-0.5 block text-xs text-(--text-muted)">
                              {[
                                session.session_title ? unitLabel(i + 1) : null,
                                own.length ? own.map(meetingLabel).join(', ') : null,
                                materials.length ? t('materialCount', { count: materials.length }) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          {hasBody ? <ChevronDown aria-hidden className="course-session-chevron" size={18} strokeWidth={1.5} /> : null}
                        </summary>
                        {hasBody ? (
                          <div className="course-session-body" dir={dir} lang={lang}>
                            {session.description ? (
                              <RichTextField className="article-prose article-prose--notes" data={session.description} />
                            ) : null}
                            {materials.length ? <MaterialList items={materials} /> : null}
                            {activities.length ? (
                              <div>
                                <p className="text-xs text-(--text-muted)">{t('activities')}</p>
                                <ul className="mt-2 grid gap-1.5 text-sm">
                                  {activities.map((a, j) => (
                                    <li dir="auto" key={a.id ?? j}>
                                      <span className="font-medium">{t(`activityKinds.${a.kind}`)}</span>
                                      {a.description ? ` — ${a.description}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </details>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null}

          {course.bibliography?.length ? (
            <section aria-labelledby="course-bibliography" className="mt-12">
              <h2 className="course-heading" id="course-bibliography">
                {t('bibliography')}
              </h2>
              <div className="mt-4">
                <MaterialList items={course.bibliography} />
              </div>
            </section>
          ) : null}
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--site-header-height,4rem)+1.5rem)] grid gap-4">
            {factsCard}
            {fellows.length ? <div className="course-card">{facultyCard}</div> : null}
            {materialsCard}
          </div>
        </aside>
      </div>

      {related.length && cycleLabel ? (
        <section aria-labelledby="course-related" className="mt-20 border-t border-border pt-10">
          <h2 className="course-heading flex items-center gap-2" id="course-related">
            {SeasonIcon ? <SeasonIcon aria-hidden className="course-season" data-season={season} size={18} strokeWidth={1.5} /> : null}
            {t('alsoIn', { cycle: cycleLabel })}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.slice(0, RELATED_SHOWN).map((r) => (
              <li key={r.id}>
                <Link className="course-related group" href={`/study/${r.slug}`}>
                  <span className="course-related-image">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={r.image.alt} loading="lazy" src={r.image.url} />
                    ) : SeasonIcon ? (
                      <SeasonIcon aria-hidden size={28} strokeWidth={1.25} />
                    ) : null}
                  </span>
                  <span className="mt-3 block text-xs text-[var(--text-muted)]">{tf(`types.${r.type.toLowerCase()}`)}</span>
                  <span className="mt-1 block font-medium underline-offset-4 group-hover:underline" dir="auto">
                    {r.title}
                  </span>
                  {r.fellows.length ? (
                    <span className="mt-1 block text-sm text-[var(--text-secondary)]">{r.fellows.join(', ')}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {related.length > RELATED_SHOWN && cycle && season ? (
            <Link
              className="mt-8 inline-flex h-9 items-center rounded-full px-4 text-sm shadow-[0_0_0_1px_var(--border)] hover:bg-[var(--surface-muted)]"
              href={`/study?season=${season}&year=${cycle.start_year}`}
            >
              {t('allInCycle', { count: related.length + 1 })}
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

/** Materials with their kind's icon: the title (linked when it has one) and its note. */
function MaterialList({ items }: { items: Material[] }) {
  const t = useTranslations('Course')
  return (
    <ul className="grid gap-2.5">
      {items.map((m, i) => {
        if (!m?.title) return null
        const Icon = MATERIAL_ICONS[m.type] ?? Link2
        return (
          <li className="grid grid-cols-[1.25rem_1fr] gap-x-3 text-sm leading-snug" key={m.id ?? i}>
            <Icon aria-label={t(`materialTypes.${m.type}`)} className="mt-0.5 text-(--text-muted)" role="img" size={16} strokeWidth={1.5} />
            <span dir="auto">
              {m.href ? (
                <a className="underline decoration-(--border-strong,var(--border)) underline-offset-4 hover:decoration-current" href={m.href} rel="noopener" target="_blank">
                  {m.title}
                </a>
              ) : (
                <span>{m.title}</span>
              )}
              {m.note ? <span className="block text-(--text-muted)">{m.note}</span> : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
