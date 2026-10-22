import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Clock,
  Headphones,
  Languages,
  Link2,
  ListOrdered,
  MapPin,
  MapPinned,
  MessageCircleQuestion,
  MessagesSquare,
  PencilLine,
  Presentation,
  Projector,
  Shapes,
  type LucideIcon,
} from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import React from 'react'

import { Avatar } from '@/components/arc/avatar/avatar'
import {
  SyllabusFeed,
  type SyllabusEntry,
  type SyllabusGroup,
} from '@/components/arc/blocks/syllabus-feed/syllabus-feed'
import { photoOf } from '@/components/person/contributors'
import { RichTextField } from '@/components/RichTextField'
import { SEASON_ICONS } from '@/components/season-icon'
import { ShareBar } from '@/components/share-bar'
import { StudyWithAI } from '@/components/study-with-ai'
import { Link } from '@/i18n/navigation'
import { weekdayOf as cairoWeekday } from '@/lib/cairo-day'
import { localDigits, numberingSystemOf, timeDir } from '@/lib/digits'
import type { Season } from '@/lib/cycle'
import { priceLabel, pricingFor } from '@/lib/pricing'
import { registrationStatus } from '@/lib/registration'
import { EditorFields, labelOf } from '@/components/editor-fields'
import { editableIn, type Editable } from '@/lib/editable'
import { expandSchedule, sessionsInOrder } from '@/lib/schedule'
import type { Course, Media, Person, Place } from '@/payload-types'

import { newTab } from './new-tab'
import { RegisterBar } from './RegisterBar'

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

/** What kind of thing a material is: read, watched, listened to, answered, or followed. */
export const MATERIAL_ICONS: Record<MaterialType, LucideIcon> = {
  reading: BookOpen,
  watch: Clapperboard,
  listen: Headphones,
  prompt: MessageCircleQuestion,
  other: Link2,
}
const MATERIAL_ORDER: MaterialType[] = ['reading', 'watch', 'listen', 'prompt', 'other']

type ActivityKind = NonNullable<
  NonNullable<Course['sessions']>[number]['activities']
>[number]['kind']

/** What happens in the session: talked over, visited, practised, watched together, presented. */
const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  discussion: MessagesSquare,
  field_visit: MapPinned,
  exercise: PencilLine,
  screening: Projector,
  presentation: Presentation,
  other: Shapes,
}

const isObject = <T,>(v: unknown): v is T => typeof v === 'object' && v !== null

/** Every text in a rich-text tree, joined. */
const textOf = (node: unknown): string => {
  if (!isObject<{ text?: unknown; children?: unknown[]; root?: unknown }>(node)) return ''
  if (node.root) return textOf(node.root)
  return [
    typeof node.text === 'string' ? node.text : '',
    ...(node.children ?? []).map(textOf),
  ].join(' ')
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
        .join(locale === 'ar' ? '، ' : ', ')
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
  // A site form opens the course's apply page; an external link opens in a new tab.
  const method = course.registration?.method ?? cycle?.registration?.method
  const siteForm = course.registration?.form ?? cycle?.registration?.form
  const applyUrl = !open
    ? null
    : method === 'form'
      ? siteForm
        ? `/${locale}/study/${course.slug}/apply`
        : null
      : (course.registration?.url ?? null)

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
  const unitLabel = (n: number) =>
    course.session_unit === 'week' ? t('week', { number: n }) : t('session', { number: n })

  // Every material, for the sidebar's count by kind.
  const allMaterials = [
    ...sessions.flatMap((s) => s.bibliography ?? []),
    ...(course.bibliography ?? []),
  ]
  const counts = MATERIAL_ORDER.map((type) => ({
    type,
    count: allMaterials.filter((m) => m.type === type).length,
  })).filter((c) => c.count > 0)

  // The weekly meeting time, from the first meeting of each slot.
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
  const comma = locale === 'ar' ? '، ' : ', '

  /*
   * The syllabus, as the feed receives it: each session with its first
   * meeting, its month, its facet kinds, its text rendered once here (rich
   * description, reading list, activities), and the visual editor's marks
   * carried as plain data into the client component.
   */
  const monthName = (month: string, width: 'long' | 'short') =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), {
      month: width,
      year: 'numeric',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })

  const syllabusEntries: SyllabusEntry[] = sessions.map((session, i) => {
    // Sessions show in their `order`; the editor needs their place in the data.
    const at = Math.max(0, (course.sessions ?? []).findIndex((s) => s.id === session.id))
    const own = meetings.filter((m) => m.session === i + 1)
    const materials = session.bibliography ?? []
    const activities = session.activities ?? []
    const hasBody = Boolean(session.description || materials.length || activities.length)
    const first = own.find((m) => !m.cancelled) ?? own[0]
    const date = first?.date
    return {
      id: String(session.id ?? `session-${i}`),
      // A session with no announced date closes the list, under its own group.
      month: date ? date.slice(0, 7) : '',
      no: localDigits(String(i + 1), locale),
      ...(date ? { date: { label: dayLabel(date), iso: date } } : {}),
      title: session.session_title || unitLabel(i + 1),
      meta: {
        unit: session.session_title ? unitLabel(i + 1) : undefined,
        meetings: own.map((m) => ({
          date: dayLabel(m.date),
          time: localDigits(`${m.start_time}–${m.end_time}`, locale),
        })),
        extra: materials.length ? [t('materialCount', { count: materials.length })] : undefined,
      },
      cancelled: Boolean(session.cancelled),
      activities: [...new Set(activities.map((a) => a.kind))],
      materials: [...new Set(materials.map((m) => m.type))],
      body:
        hasBody || editable ? (
          <SessionBody session={session} at={at} pe={pe} editable={editable} dir={dir} lang={lang} />
        ) : undefined,
      attrs: {
        row: pe(`sessions.${at}`, { row: { id: session.id } }),
        title: pe(`sessions.${at}.session_title`),
        meta: pe(`sessions.${at}.dates`),
      },
    }
  })

  // Months as the sessions first introduce them, closest to oldest.
  const monthKeys: string[] = []
  for (const entry of syllabusEntries)
    if (!monthKeys.includes(entry.month)) monthKeys.push(entry.month)
  const syllabusGroups: SyllabusGroup[] = monthKeys.map((month) => ({
    key: month,
    label: month ? monthName(month, 'long') : t('feedUnscheduled'),
    short: month ? monthName(month, 'short').split(' ')[0]! : '·',
  }))
  const firstBodyId = syllabusEntries.find((entry) => entry.body)?.id
  const syllabusFeed = (
    <SyllabusFeed
      entries={syllabusEntries}
      groups={syllabusGroups}
      title={t('flow')}
      subtitle={course.syllabus_tentative ? t('tentative') : undefined}
      headerAttrs={course.syllabus_tentative ? { subtitle: pe('syllabus_tentative') } : undefined}
      defaultOpen={firstBodyId ? [firstBodyId] : []}
      openAll={editable}
      containerAttrs={pe.container('sessions')}
    />
  )

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
            value:
              course.schedule?.start_precision === 'week'
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

  // The side column names who teaches; their bios are read in the main text.
  const facultyCard = (
    <section aria-labelledby="course-fellows" className="course-side" {...pe('fellows')}>
      <h2 className="course-side-heading" id="course-fellows">
        {t('taughtBy')}
      </h2>
      <ul className="grid gap-3">
        {fellows.map((person) => (
          <li key={person.id}>
            <Link className="group flex items-center gap-3" href={`/people/${person.slug}`}>
              <span className="course-fellow-photo">
                <Avatar name={person.name} size="md" src={photoOf(person)} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-medium underline-offset-4 group-hover:underline">
                  {person.name}
                </span>
                <span className="block text-xs text-[var(--text-muted)]">{t('fellow')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )

  // Each fellow with their whole bio: who teaches a course matters to it.
  const fellowsSection = fellows.length ? (
    <section aria-labelledby="course-teachers" className="mt-12" {...pe('fellows')}>
      <h2 className="course-heading" id="course-teachers">
        {t('whoTeaches')}
      </h2>
      <ul className="course-fellows">
        {fellows.map((person) => {
          const hasBio = Boolean(textOf(person.bio).trim())
          return (
            <li className="course-fellow" key={person.id}>
              <Link
                aria-hidden
                className="course-fellow-photo"
                href={`/people/${person.slug}`}
                tabIndex={-1}
              >
                <Avatar name={person.name} size="lg" src={photoOf(person)} />
              </Link>
              <div className="course-fellow-head">
                <h3 className="text-base font-medium">
                  <Link
                    className="underline-offset-4 hover:underline"
                    href={`/people/${person.slug}`}
                  >
                    {person.name}
                  </Link>
                </h3>
                <p className="text-sm text-[var(--text-muted)]">{t('fellow')}</p>
              </div>
              {hasBio ? (
                <div className="course-fellow-bio" dir="auto">
                  <RichTextField className="grid gap-3 [&_p]:m-0" data={person.bio} />
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  ) : null

  const factsCard = (
    <section aria-label={t('details')} className="course-side">
      <div className="flex items-center justify-between gap-3">
        <span className="course-status" data-open={open || undefined} {...pe('registration')}>
          {open ? t('open') : t('closed')}
        </span>
        {price ? (
          <span className="text-sm text-(--text-secondary)" {...pe('pricing_override')}>
            {price}
          </span>
        ) : null}
      </div>
      {applyUrl ? (
        <a className="course-apply" data-primary href={applyUrl} {...newTab(applyUrl)}>
          {t('apply')}
        </a>
      ) : null}
      {facts.length ? (
        <dl className="course-facts">
          {facts.map(({ icon: Icon, label, value, path }) => (
            <div
              className="grid grid-cols-[1.25rem_1fr] items-start gap-x-3"
              key={label}
              {...pe(path)}
            >
              <Icon
                aria-hidden
                className="mt-0.5 text-(--text-muted)"
                size={16}
                strokeWidth={1.5}
              />
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
    <section aria-labelledby="course-materials" className="course-side">
      <h2 className="course-side-heading" id="course-materials">
        {t('materials')}
      </h2>
      <ul className="grid gap-2">
        {counts.map(({ type, count }) => {
          const Icon = MATERIAL_ICONS[type]
          return (
            <li className="grid grid-cols-[1.25rem_1fr] items-center gap-x-3 text-sm" key={type}>
              <Icon aria-hidden className="text-(--text-muted)" size={16} strokeWidth={1.5} />
              {t(`materialCounts.${type}`, { count })}
            </li>
          )
        })}
      </ul>
    </section>
  ) : null

  const shareCard = (
    <section aria-labelledby="course-share" className="course-side">
      <h2 className="course-side-heading" id="course-share">
        {ts('heading')}
      </h2>
      <ShareBar
        label={ts('course')}
        path={`/${locale}/study/${course.slug}`}
        title={course.title}
        email={email}
      />
    </section>
  )

  // Taking the course with AI: its own card, at Share's spacing and rhythm.
  const aiCard = (
    <section aria-labelledby="course-ai" className="course-side">
      <h2 className="course-side-heading" id="course-ai">
        {ts('aiHeading')}
      </h2>
      <StudyWithAI kind="course" path={`/${locale}/study/${course.slug}`} />
      <p className="text-xs text-(--text-muted)">{ts('aiNote')}</p>
    </section>
  )

  return (
    <div
      className={`course-page mx-auto w-full max-w-6xl px-4 py-10 sm:px-8 sm:py-14 xl:px-0 ${applyUrl ? 'max-lg:pb-28' : ''}`}
      {...pe.scope({ collection: 'courses', id: course.id })}
    >
      {applyUrl ? (
        <div className="lg:hidden">
          <RegisterBar
            applyLabel={t('apply')}
            applyUrl={applyUrl}
            price={price}
            status={t('open')}
            variant="bar"
          />
        </div>
      ) : null}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <article aria-labelledby="course-title" className="min-w-0">
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
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={cover.alt ?? ''}
              className="course-cover mt-8"
              src={cover.url}
              {...pe('cover_image')}
            />
          ) : null}

          {/* Narrow screens: the facts and the fellows come before the text. */}
          <div className="mt-10 grid gap-10 lg:hidden">
            {factsCard}
            {shareCard}
            {aiCard}
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

          {course.facilitator_note ? (
            <section
              aria-labelledby="course-note"
              className="course-note mt-10"
              {...pe('facilitator_note')}
            >
              <h2 className="font-sans text-sm font-medium" id="course-note">
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
            <div className="mt-12">{syllabusFeed}</div>
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
          {after}
        </article>

        <aside className="hidden lg:flex lg:flex-col lg:gap-10">
          {/* Not sticky: a fellow's bio can make the column taller than the screen.
              Only applying follows the reader down, at the column's end. */}
          <div className="grid gap-10">
            {factsCard}
            {fellows.length ? facultyCard : null}
            {materialsCard}
            {shareCard}
            {aiCard}
          </div>
          {applyUrl ? (
            <div className="sticky top-22">
              <RegisterBar
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
                <Link className="course-related group" href={`/study/${r.slug}`}>
                  <span className="course-related-image">
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={r.image.alt} loading="lazy" src={r.image.url} />
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

/**
 * One session's own text, materials and activities — the syllabus feed
 * opens it. The same markup the number-only list rendered; it now sits in
 * months' own panel.
 */
function SessionBody({
  session,
  at,
  pe,
  editable,
  dir,
  lang,
}: {
  session: NonNullable<Course['sessions']>[number]
  at: number
  pe: Editable
  editable?: boolean
  dir: 'ltr' | 'rtl'
  lang: string
}) {
  const t = useTranslations('Course')
  const materials = session.bibliography ?? []
  const activities = session.activities ?? []
  return (
    <div className="grid gap-5" dir={dir} lang={lang}>
      {session.description ? (
        <div {...pe(`sessions.${at}.description`)}>
          <RichTextField className="article-prose article-prose--notes" data={session.description} />
        </div>
      ) : editable ? (
        // Something to double-click while the session has no text yet.
        <p className="text-sm text-(--text-muted)" dir="ltr" lang="en" {...pe(`sessions.${at}.description`)}>
          Description
        </p>
      ) : null}
      {materials.length || editable ? (
        <MaterialList items={materials} path={`sessions.${at}.bibliography`} pe={pe} />
      ) : null}
      {activities.length || editable ? (
        <div>
          <p className="text-xs text-(--text-muted)">{t('activities')}</p>
          {/* Laid out as the materials are: the kind's icon in its own column. */}
          <ul
            className={`mt-2 grid gap-2.5 ${activities.length ? '' : 'min-h-8'}`}
            {...pe.container(`sessions.${at}.activities`)}
          >
            {activities.map((a, j) => {
              const Icon = ACTIVITY_ICONS[a.kind] ?? Shapes
              return (
                <li
                  className="grid grid-cols-[1.25rem_1fr] gap-x-3 text-sm leading-snug"
                  dir="auto"
                  key={a.id ?? j}
                  {...pe(`sessions.${at}.activities.${j}`, {
                    row: { id: a.id },
                  })}
                >
                  <Icon aria-hidden className="mt-0.5 text-(--text-muted)" size={16} strokeWidth={1.5} />
                  <span>
                    <span className="font-medium">{t(`activityKinds.${a.kind}`)}</span>
                    {a.description ? (
                      <span className="block text-(--text-secondary)">{a.description}</span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Materials with their kind's icon: the title (linked when it has one) and its
 * note. Each item reads in its own direction, so an Arabic reading on an
 * English page has its icon at its own start, beside its text.
 */
function MaterialList({ items, path, pe }: { items: Material[]; path: string; pe: Editable }) {
  const t = useTranslations('Course')
  return (
    <ul className={`grid gap-2.5 ${items.length ? '' : 'min-h-8'}`} {...pe.container(path)}>
      {items.map((m, i) => {
        if (!m?.title) return null
        const Icon = MATERIAL_ICONS[m.type] ?? Link2
        return (
          <li
            className="grid grid-cols-[1.25rem_1fr] gap-x-3 text-sm leading-snug"
            dir={directionOf(`${m.title} ${m.note ?? ''}`)}
            key={m.id ?? i}
            {...pe(`${path}.${i}`, { row: { id: m.id } })}
          >
            <Icon
              aria-label={t(`materialTypes.${m.type}`)}
              className="mt-0.5 text-(--text-muted)"
              role="img"
              size={16}
              strokeWidth={1.5}
            />
            <span>
              {m.href ? (
                <a
                  className="underline decoration-(--border-strong,var(--border)) underline-offset-4 hover:decoration-current"
                  href={m.href}
                  rel="noopener"
                  target="_blank"
                >
                  <span {...pe(`${path}.${i}.title`)}>{m.title}</span>
                </a>
              ) : (
                <span {...pe(`${path}.${i}.title`)}>{m.title}</span>
              )}
              {m.note ? (
                <span className="block text-(--text-muted)" {...pe(`${path}.${i}.note`)}>
                  {m.note}
                </span>
              ) : null}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
