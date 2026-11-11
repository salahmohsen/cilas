import Image from 'next/image'
import { personAvatarSeed } from '@/lib/avatar'
import { listSeparator } from '@/lib/locale-format'
import { detailPath } from '@/lib/paths'
import { isRelation as isObject } from '@/lib/relation'
import { hasDayPrecision } from '@/lib/schedule'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock,
  Languages,
  ListOrdered,
  MapPin,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import React from 'react'

import { AIInstructions } from '@/components/ai-instructions'
import { InViewTitle } from '@/components/arc/in-view-title/in-view-title'
import {
  CourseSyllabus,
  MATERIAL_ICONS,
  MATERIAL_ORDER,
  MaterialList,
  directionOf,
  textOf,
} from '@/components/course/course-syllabus'
import { EditorFields, labelOf } from '@/components/editor-fields'
import { AvatarFallback } from '@/components/arc/lib/avatar-fallback'
import { ContributorRows, photoOf } from '@/components/person/contributors'
import { RichTextField } from '@/components/RichTextField'
import { SEASON_ICONS } from '@/components/season-icon'
import { ShareBar } from '@/components/share-bar'
import { SideCard, SideCardApply, SideCardSection } from '@/components/side-card'
import { StudyWithAI } from '@/components/study-with-ai'
import { Link } from '@/i18n/navigation'
import { weekdayOf as cairoWeekday } from '@/lib/cairo-day'
import type { Season } from '@/lib/cycle'
import { localDigits, numberingSystemOf, timeDir } from '@/lib/digits'
import { editableIn } from '@/lib/editable'
import { focalPointStyle } from '@/lib/media-image'
import { POSTER_COLORS } from '@/components/arc/lib/poster-colors'
import { contributionLabel } from '@/lib/pricing'
import { courseRegistration } from '@/lib/registration'
import { expandSchedule, sessionsInOrder } from '@/lib/schedule'
import { textDirection } from '@/lib/text-direction'
import type { Course, Media, Person, Place } from '@/payload-types'

import { RegisterBar } from '@/components/course/RegisterBar'
import { newTab } from '@/lib/new-tab'

/** A course in the same cycle, as the end of the page lists it. */
export type RelatedCourse = {
  id: number
  slug: string
  title: string
  type: Course['course_type']
  fellows: string[]
  image?: { url: string; alt: string; focalX?: number | null; focalY?: number | null }
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
export const CourseView: React.FC<{
  course: Course
  related?: RelatedCourse[]
  /** In the admin's live preview: mark fields for the visual editor. */
  editable?: boolean
  /** At the end of the text, e.g. the newsletter signup. */
  after?: React.ReactNode
  /** The institute's info address (Site settings), the share bar's mail recipient. */
  email?: string | null
}> = ({ course, related = [], editable = false, after, email }) => {
  const pe = editableIn(editable)
  const t = useTranslations('Course')
  const tf = useTranslations('Study.filters')
  const ts = useTranslations('Share')
  const format = useFormatter()
  const locale = useLocale()

  const cover =
    isObject<Media>(course.cover_image) && course.cover_image.url ? course.cover_image : null
  const cycle = isObject<NonNullable<Course['cycle']> & object>(course.cycle) ? course.cycle : null
  const place = cycle && isObject<Place>(cycle.place) ? cycle.place : null
  const season = (cycle?.season ?? null) as Season | null
  const SeasonIcon = season ? SEASON_ICONS[season] : null
  const cycleLabel = cycle
    ? [
        `${tf(`seasons.${season}`)} ${localDigits(cycle.start_year, locale)}`,
        place?.city ?? place?.name,
      ]
        .filter(Boolean)
        .join(listSeparator(locale))
    : null
  const typeLabel = tf(`types.${course.course_type.toLowerCase()}`)
  const fellows = (course.fellows ?? []).filter(isObject<Person>)
  const dir = directionOf(`${course.title} ${course.subtitle ?? ''} ${textOf(course.description)}`)
  const lang = dir === 'rtl' ? 'ar' : 'en'

  const sessions = sessionsInOrder(course.sessions ?? [])
  const meetings = expandSchedule(course.schedule, course.sessions)
  const firstMeeting = meetings.find((m) => !m.cancelled)
  const registration = courseRegistration(course, cycle)
  const price = contributionLabel(registration.price, { locale })
  const open = registration.status === 'open'
  const { method, formId: siteForm, url } = registration
  const applyUrl = !open
    ? null
    : method === 'form'
      ? siteForm
        ? detailPath('courses', String(course.slug), locale, 'apply')
        : null
      : url

  /** "Tue 3 Mar". Days are Cairo calendar days, so format them in UTC. */
  const dayLabel = (day: string, weekday: 'short' | 'long' = 'short'): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      weekday,
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })
  const weekdayName = (day: string): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), { weekday: 'long', timeZone: 'UTC' })

  const allMaterials = [
    ...sessions.flatMap((s) => s.bibliography ?? []),
    ...(course.bibliography ?? []),
  ]
  const counts = MATERIAL_ORDER.map((type) => ({
    type,
    count: allMaterials.filter((m) => m.type === type).length,
  })).filter((c) => c.count > 0)

  const slots = (course.schedule?.slots ?? []).flatMap((slot) => {
    const first = meetings.find(
      (m) =>
        !m.cancelled && cairoWeekday(m.date) === slot.weekday && m.start_time === slot.start_time,
    )
    return first
      ? [
          {
            day: weekdayName(first.date),
            time: localDigits(`${slot.start_time}–${slot.end_time}`, locale),
          },
        ]
      : []
  })
  const comma = listSeparator(locale)

  const facts: Array<{ icon: LucideIcon; label: string; value: React.ReactNode; path: string }> = [
    ...(cycleLabel && SeasonIcon
      ? [{ icon: SeasonIcon, label: t('cycle'), value: cycleLabel, path: 'cycle' }]
      : []),
    ...(firstMeeting
      ? [
          {
            icon: CalendarDays,
            label: t('starts'),
            path: 'schedule',
            value: !hasDayPrecision(course.schedule)
              ? t('weekOf', { date: dayLabel(firstMeeting.date) })
              : dayLabel(firstMeeting.date, 'long'),
          },
        ]
      : []),
    ...(slots.length
      ? [
          {
            icon: Clock,
            label: t('meets'),
            path: 'schedule.slots',
            // A slot a line; the time held in its digits' direction, so it never reads backwards.
            value: slots.map(({ day, time }) => (
              <span className="block" key={`${day}${time}`}>
                {day}
                {comma}
                <span className="whitespace-nowrap tabular-nums" dir={timeDir(locale)}>
                  {time}
                </span>
              </span>
            )),
          },
        ]
      : []),
    ...(sessions.length
      ? [
          {
            icon: ListOrdered,
            label: t('length'),
            path: 'session_unit',
            value:
              course.session_unit === 'week'
                ? t('weeks', { count: sessions.length })
                : t('sessions', { count: sessions.length }),
          },
        ]
      : []),
    ...(course.location?.length
      ? [
          {
            icon: MapPin,
            label: t('format'),
            path: 'location',
            value: course.location.map((l) => tf(`formats.${l.toLowerCase()}`)).join(' / '),
          },
        ]
      : []),
    ...(course.teaching_languages?.length || course.language_note
      ? [
          {
            icon: Languages,
            label: t('language'),
            path: course.language_note ? 'language_note' : 'teaching_languages',
            value:
              course.language_note ||
              course.teaching_languages!.map((l) => tf(`languages.${l}`)).join(' / '),
          },
        ]
      : []),
  ]

  const note = course.facilitator_note?.trim()
  const noteDir = note ? textDirection(note) : 'ltr'
  const noteHead = (
    <span className="fellow-card-hazard-head">
      <span className="fellow-card-hazard-icon">
        <MessageSquareText aria-hidden size={18} strokeWidth={1.75} />
      </span>
      <span className="fellow-card-hazard-label">{t('note')}</span>
    </span>
  )
  const noteQuote = note ? (
    <blockquote className="fellow-card-quote" dir={noteDir} lang={noteDir === 'rtl' ? 'ar' : 'en'}>
      {note.split(/\n\s*\n/).map((p, i) => (
        <p className="whitespace-pre-line" key={i}>
          {p}
        </p>
      ))}
    </blockquote>
  ) : null
  const noteInCard = fellows.length === 1
  const cardColors = (index: number) =>
    ({ '--poster-color': POSTER_COLORS[index % POSTER_COLORS.length] }) as React.CSSProperties
  const fellowsSection =
    fellows.length || note ? (
      <section aria-labelledby="course-teachers" className="mt-12" {...pe('fellows')}>
        <h2 className="course-heading" id="course-teachers">
          {t('whoTeaches')}
        </h2>
        {fellows.length ? (
          <ul className="fellow-cards">
            {fellows.map((person, index) => {
              const hasBio = Boolean(textOf(person.bio).trim())
              const photo = photoOf(person)
              return (
                <li className="fellow-card-frame" key={person.id}>
                  {/* The registration poster's look: ink rules, paper cells and
                      one palette colour per card (docs/content-driven-card-layouts.md). */}
                  <article
                    aria-labelledby={`fellow-${person.id}`}
                    className="fellow-card"
                    style={cardColors(index)}
                  >
                    <div className="fellow-card-body">
                      <Link
                        aria-hidden
                        className="fellow-card-photo"
                        href={detailPath('people', String(person.slug))}
                        tabIndex={-1}
                      >
                        {photo ? (
                          <Image
                            width={
                              typeof person.photo === 'object' ? person.photo?.width || 800 : 800
                            }
                            height={
                              typeof person.photo === 'object' ? person.photo?.height || 600 : 600
                            }
                            sizes="auto, (min-width: 72rem) 18rem, (min-width: 64rem) calc(100vw - 28.5rem), (min-width: 48rem) 18rem, calc(100vw - 2rem)"
                            alt=""
                            loading="lazy"
                            src={photo}
                            style={focalPointStyle(
                              typeof person.photo === 'object' ? person.photo : undefined,
                            )}
                          />
                        ) : (
                          <AvatarFallback seed={personAvatarSeed(person.id)} aria-hidden />
                        )}
                      </Link>
                      <div className="fellow-card-main">
                        <div className="fellow-card-panel">
                          <Link
                            className="fellow-card-name-link"
                            href={detailPath('people', String(person.slug))}
                          >
                            <div className="fellow-card-name" dir={textDirection(person.name)}>
                              <InViewTitle
                                as="h3"
                                className="fellow-card-name-reveal"
                                id={`fellow-${person.id}`}
                                once={false}
                                text={person.name}
                                variant="line"
                              />
                            </div>
                            <ArrowRight
                              aria-hidden
                              className="fellow-card-arrow"
                              size={20}
                              strokeWidth={1.75}
                            />
                          </Link>
                        </div>
                        {hasBio ? (
                          <div className="fellow-card-bio" dir="auto">
                            <RichTextField className="grid gap-3 [&_p]:m-0" data={person.bio} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {note && noteInCard ? (
                      <figure className="fellow-card-note" {...pe('facilitator_note')}>
                        <figcaption className="fellow-card-hazard">{noteHead}</figcaption>
                        {noteQuote}
                      </figure>
                    ) : null}
                  </article>
                </li>
              )
            })}
          </ul>
        ) : null}
        {note && !noteInCard ? (
          <div className="fellow-card-frame mt-4">
            <figure
              className="fellow-card fellow-card-note"
              style={cardColors(fellows.length)}
              {...pe('facilitator_note')}
            >
              <figcaption className="fellow-card-hazard">{noteHead}</figcaption>
              {noteQuote}
            </figure>
          </div>
        ) : null}
      </section>
    ) : null

  // The side column as one card (docs/content-driven-card-layouts.md, side
  // card): status, price and apply; the facts; who teaches; the materials;
  // sharing; studying it with AI. Each part in its own ruled section.
  const applyCard = (
    <div {...pe('registration')}>
      <SideCardApply
        applyLabel={t('apply')}
        applyUrl={applyUrl}
        newTab={applyUrl ? Boolean(newTab(applyUrl).target) : false}
        open={open}
        price={price}
        primary
        status={open ? t('open') : t('closed')}
      />
    </div>
  )
  const coursePath = detailPath('courses', String(course.slug), locale)
  const sideCard = (wide: boolean) => (
    <SideCard color={POSTER_COLORS[0]} label={t('details')}>
      <SideCardSection label={t('details')}>
        {facts.length ? (
          <dl className="side-card-facts">
            {facts.map(({ icon: Icon, label, value, path }) => (
              <div key={label} {...pe(path)}>
                <span className="side-card-icon">
                  <Icon aria-hidden size={16} strokeWidth={1.5} />
                </span>
                <div>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        ) : null}
      </SideCardSection>
      {course.schedule?.note ? (
        <p className="side-card-muted whitespace-pre-line" {...pe('schedule.note')}>
          {course.schedule.note}
        </p>
      ) : null}
      {wide && fellows.length ? (
        <div {...pe('fellows')}>
          <SideCardSection label={t('taughtBy')}>
            <ContributorRows
              contributors={fellows.map((person) => ({ person, role: t('fellow') }))}
            />
          </SideCardSection>
        </div>
      ) : null}
      {wide && counts.length ? (
        <SideCardSection label={t('materials')}>
          <ul className="side-card-facts">
            {counts.map(({ type, count }) => {
              const Icon = MATERIAL_ICONS[type]
              return (
                <li key={type}>
                  <span className="side-card-icon">
                    <Icon aria-hidden size={16} strokeWidth={1.5} />
                  </span>
                  <span>{t(`materialCounts.${type}`, { count })}</span>
                </li>
              )
            })}
          </ul>
        </SideCardSection>
      ) : null}
      {wide ? (
        <>
          <SideCardSection label={ts('heading')}>
            <div className="side-card-body side-card-flush side-card-scroll">
              <ShareBar label={ts('course')} path={coursePath} title={course.title} email={email} />
            </div>
          </SideCardSection>
          <SideCardSection label={ts('aiHeading')} labelAction={<AIInstructions />}>
            <div className="side-card-body side-card-flush">
              <StudyWithAI kind="course" path={coursePath} />
            </div>
          </SideCardSection>
        </>
      ) : null}
    </SideCard>
  )

  return (
    <div
      className={`course-page page-frame py-10 sm:py-14 ${applyUrl ? 'max-lg:pb-28' : ''}`}
      {...pe.scope({ collection: 'courses', id: course.id })}
    >
      {applyUrl ? (
        <div className="lg:hidden">
          <RegisterBar
            primaryIds={['course-apply-mobile', 'course-apply-wide']}
            applyLabel={t('apply')}
            applyUrl={applyUrl}
            price={price}
            status={t('open')}
            variant="bar"
          />
        </div>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <article aria-labelledby="course-title" className="prose-frame min-w-0">
          {editable ? (
            <EditorFields
              pe={pe}
              fields={[
                { label: 'Card summary', path: 'summary', value: course.summary },
                { label: 'Visibility', path: 'tier', value: course.tier },
                { label: 'Slug', path: 'slug', value: course.slug },
                {
                  label: 'Registration',
                  path: 'registration',
                  value: course.registration?.method ?? 'From its cycle',
                },
                {
                  label: 'Deadline',
                  path: 'registration.deadline',
                  value: course.registration?.deadline?.slice(0, 10),
                },
                { label: 'Session unit', path: 'session_unit', value: course.session_unit },
                {
                  label: 'Syllabus tentative',
                  path: 'syllabus_tentative',
                  value: course.syllabus_tentative ? 'Yes' : 'No',
                },
                {
                  label: 'Teaching languages',
                  path: 'teaching_languages',
                  value: course.teaching_languages?.join(', '),
                },
                { label: 'SEO title', path: 'meta.title', value: course.meta?.title },
                {
                  label: 'SEO description',
                  path: 'meta.description',
                  value: course.meta?.description,
                },
                { label: 'SEO image', path: 'meta.image', value: labelOf(course.meta?.image) },
              ]}
            />
          ) : null}
          <Link
            className="inline-flex items-center gap-2 text-sm text-(--text-secondary) hover:text-(--text-primary)"
            href={`/study?type=${course.course_type.toLowerCase()}`}
          >
            <ArrowLeft aria-hidden className="rtl:-scale-x-100" size={16} />
            {t(`backTo.${course.course_type.toLowerCase()}`)}
          </Link>

          <header className="mt-8">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--text-secondary)">
              {SeasonIcon ? (
                <SeasonIcon
                  aria-hidden
                  className="course-season"
                  data-season={season}
                  size={16}
                  strokeWidth={1.5}
                />
              ) : null}
              {cycleLabel ? <span {...pe('cycle')}>{cycleLabel}</span> : null}
              <span aria-hidden="true">·</span>
              <span {...pe('course_type')}>{typeLabel}</span>
            </p>
            <h1
              className="course-title mt-3"
              dir={dir}
              id="course-title"
              lang={lang}
              {...pe('title')}
            >
              {course.title}
            </h1>
            {course.subtitle ? (
              <p className="mt-3 text-lg text-(--text-secondary)" dir="auto" {...pe('subtitle')}>
                {course.subtitle}
              </p>
            ) : null}
          </header>

          {cover?.url ? (
            <Image
              preload
              sizes="(min-width: 90rem) 61.5rem, (min-width: 64rem) calc(100vw - 28.5rem), (min-width: 40rem) calc(100vw - 3rem), calc(100vw - 2rem)"
              alt={cover.alt ?? ''}
              className="course-cover mt-8"
              width={cover.width || 800}
              height={cover.height || 600}
              src={cover.url}
              style={focalPointStyle(cover)}
              {...pe('cover_image')}
            />
          ) : null}

          <div className="mt-10 grid gap-6 lg:hidden">
            <div id="course-apply-mobile">{applyCard}</div>
            {sideCard(false)}
          </div>

          {course.epigraph ? (
            <div className="article-prose mt-10" {...pe('epigraph')}>
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
              <div dir={dir} lang={lang} {...pe('description')}>
                <RichTextField className="article-prose mt-4" data={course.description} />
              </div>
            </section>
          ) : null}

          {course.content_warning ? (
            <p
              className="mt-6 border-s-2 border-foreground ps-4 text-sm"
              role="note"
              {...pe('content_warning')}
            >
              <span className="font-medium">{t('contentWarning')}</span> {course.content_warning}
            </p>
          ) : null}

          {fellowsSection}

          {sessions.length ? (
            <div className="mt-12">
              <CourseSyllabus className="course-flow" course={course} editable={editable} />
            </div>
          ) : null}

          {course.bibliography?.length || editable ? (
            <section aria-labelledby="course-bibliography" className="mt-12">
              <h2 className="course-heading" id="course-bibliography">
                {t('bibliography')}
              </h2>
              <div className="mt-4">
                <MaterialList items={course.bibliography ?? []} path="bibliography" pe={pe} />
              </div>
            </section>
          ) : null}
          <section
            aria-labelledby="course-share"
            className="mt-12 grid gap-3 border-t border-border pt-6 lg:hidden"
          >
            <h2 className="font-sans text-sm text-[var(--text-muted)]" id="course-share">
              {ts('heading')}
            </h2>
            <ShareBar label={ts('course')} path={coursePath} title={course.title} email={email} />
          </section>
          <section
            aria-labelledby="course-ai"
            className="mt-6 grid gap-3 border-t border-border pt-6 lg:hidden"
          >
            <h2
              className="flex items-center justify-between gap-2 font-sans text-sm text-[var(--text-muted)]"
              id="course-ai"
            >
              {ts('aiHeading')}
              <AIInstructions />
            </h2>
            <StudyWithAI kind="course" path={coursePath} />
          </section>
          {after}
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-10">
          {/* Not sticky: a fellow's bio can make the column taller than the screen.
              Only applying follows the reader down, at the column's end. */}
          <div className="grid gap-6">
            <div id="course-apply-wide">{applyCard}</div>
            {sideCard(true)}
          </div>
          {applyUrl ? (
            <div className="sticky top-22">
              <RegisterBar
                primaryIds={['course-apply-mobile', 'course-apply-wide']}
                applyLabel={t('apply')}
                applyUrl={applyUrl}
                price={price}
                status={t('open')}
                variant="side"
              />
            </div>
          ) : null}
        </aside>
      </div>

      {related.length && cycleLabel ? (
        <section aria-labelledby="course-related" className="mt-20 border-t border-border pt-10">
          <h2 className="course-heading flex items-center gap-2" id="course-related">
            {SeasonIcon ? (
              <SeasonIcon
                aria-hidden
                className="course-season"
                data-season={season}
                size={18}
                strokeWidth={1.5}
              />
            ) : null}
            {t('alsoIn', { cycle: cycleLabel })}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.slice(0, RELATED_SHOWN).map((r) => (
              <li key={r.id}>
                <Link className="course-related group" href={detailPath('courses', String(r.slug))}>
                  <span className="course-related-image">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={r.image.alt}
                        loading="lazy"
                        src={r.image.url}
                        style={focalPointStyle(r.image)}
                      />
                    ) : SeasonIcon ? (
                      <SeasonIcon aria-hidden size={28} strokeWidth={1.25} />
                    ) : null}
                  </span>
                  <span className="mt-3 block text-xs text-(--text-muted)">
                    {tf(`types.${r.type.toLowerCase()}`)}
                  </span>
                  <span
                    className="mt-1 block font-medium underline-offset-4 group-hover:underline"
                    dir="auto"
                  >
                    {r.title}
                  </span>
                  {r.fellows.length ? (
                    <span className="mt-1 block text-sm text-(--text-secondary)">
                      {r.fellows.join(', ')}
                    </span>
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
