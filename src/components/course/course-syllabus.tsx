import { isRelation as isObject } from '@/lib/relation'
import {
  BookOpen,
  Clapperboard,
  Headphones,
  Link2,
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
import React, { type ReactNode } from 'react'

import {
  SyllabusFeed,
  SyllabusSession,
  type SyllabusEntry,
  type SyllabusGroup,
} from '@/components/arc/blocks/syllabus-feed/syllabus-feed'
import { SessionMarkdown } from '@/components/course/session-markdown'
import { localDigits, numberingSystemOf } from '@/lib/digits'
import { editableIn, type Editable } from '@/lib/editable'
import { numberedSessions, type NumberedSession } from '@/lib/meetings'
import type { Course, Session } from '@/payload-types'

export type Material = NonNullable<Course['bibliography']>[number]
type MaterialType = Material['type']

/** What kind of thing a material is: read, watched, listened to, answered, or followed. */
export const MATERIAL_ICONS: Record<MaterialType, LucideIcon> = {
  reading: BookOpen,
  watch: Clapperboard,
  listen: Headphones,
  prompt: MessageCircleQuestion,
  other: Link2,
}
export const MATERIAL_ORDER: MaterialType[] = ['reading', 'watch', 'listen', 'prompt', 'other']

type Activity = NonNullable<Session['activities']>[number]
type ActivityKind = Activity['kind']

/** What happens in the session: talked over, visited, practised, watched together, presented. */
const ACTIVITY_ICONS: Record<ActivityKind, LucideIcon> = {
  discussion: MessagesSquare,
  field_visit: MapPinned,
  exercise: PencilLine,
  screening: Projector,
  presentation: Presentation,
  other: Shapes,
}

/** Every text in a rich-text tree, joined. */
export const textOf = (node: unknown): string => {
  if (!isObject<{ text?: unknown; children?: unknown[]; root?: unknown }>(node)) return ''
  if (node.root) return textOf(node.root)
  return [
    typeof node.text === 'string' ? node.text : '',
    ...(node.children ?? []).map(textOf),
  ].join(' ')
}

/** The direction a course's own text reads in: it may be in the other language than the page. */
export const directionOf = (text: string): 'rtl' | 'ltr' => {
  const arabic = (text.match(/[\u0600-\u06ff]/g) ?? []).length
  const latin = (text.match(/[A-Za-z]/g) ?? []).length
  return arabic >= latin ? 'rtl' : 'ltr'
}

/** The parts of a course its syllabus reads, besides its sessions. */
export type SyllabusCourse = Pick<
  Course,
  'title' | 'subtitle' | 'description' | 'syllabus_tentative'
>

/**
 * One session as the syllabus shows it, whichever store holds it: the
 * course page reads the sessions collection, a course space still the old
 * array (plan "Move course readers to sessions", unit 4).
 */
export type SyllabusSession = {
  id: string
  title?: string | null
  cancelled?: boolean | null
  delivery?: Session['delivery']
  /** Its text, rendered by the caller. */
  description?: ReactNode
  bibliography?: Material[] | null
  activities?: Activity[] | null
}

/** A course's sessions from the collection, numbered and dated, as its syllabus reads them. */
export const syllabusOf = (
  sessions: readonly Session[],
  unit: Course['session_unit'],
): NumberedSession<SyllabusSession>[] =>
  numberedSessions(sessions, unit).map((n) => ({
    ...n,
    session: {
      id: String(n.session.id),
      title: n.session.title,
      cancelled: n.session.cancelled,
      delivery: n.session.delivery,
      description: n.session.description ? (
        <SessionMarkdown
          className="article-prose article-prose--notes"
          text={n.session.description}
        />
      ) : null,
      bibliography: n.session.bibliography,
      activities: n.session.activities,
    },
  }))

/**
 * Each session as a syllabus entry: its first meeting, its month, its facet
 * kinds and its text, built once for the whole syllabus and for one session
 * shown elsewhere (a post that points at it).
 */
function useSyllabusEntries(
  course: SyllabusCourse,
  sessions: readonly NumberedSession<SyllabusSession>[],
  decorate?: (entry: SyllabusEntry, index: number) => SyllabusEntry,
): SyllabusEntry[] {
  const t = useTranslations('Course')
  const format = useFormatter()
  const locale = useLocale()

  const dir = directionOf(`${course.title} ${course.subtitle ?? ''} ${textOf(course.description)}`)
  const lang = dir === 'rtl' ? 'ar' : 'en'

  /** "Tue 3 Mar". Days are Cairo calendar days, so format them in UTC. */
  const dayLabel = (day: string): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })

  return sessions.map(({ session, number, unit, meetings, day }, i) => {
    const unitLabel = t(unit, { number })
    const materials = session.bibliography ?? []
    const activities = session.activities ?? []
    const hasBody = Boolean(session.description || materials.length || activities.length)
    const entry: SyllabusEntry = {
      id: session.id,
      // A session with no announced date closes the list, under its own group.
      month: day ? day.slice(0, 7) : '',
      no: localDigits(String(number), locale),
      ...(day ? { date: { label: dayLabel(day), iso: day } } : {}),
      title: session.title || unitLabel,
      meta: {
        unit: session.title ? unitLabel : undefined,
        meetings: meetings.map((m) => {
          const hours = [m.start_time, m.end_time].filter(Boolean).join('–')
          return { date: dayLabel(m.date), ...(hours ? { time: localDigits(hours, locale) } : {}) }
        }),
        extra:
          session.delivery || materials.length
            ? [
                ...(session.delivery ? [t(`delivery.${session.delivery}`)] : []),
                ...(materials.length ? [t('materialCount', { count: materials.length })] : []),
              ]
            : undefined,
      },
      cancelled: Boolean(session.cancelled),
      activities: [...new Set(activities.map((a) => a.kind))],
      materials: [...new Set(materials.map((m) => m.type))],
      body: hasBody ? <SessionBody session={session} dir={dir} lang={lang} /> : undefined,
    }
    return decorate ? decorate(entry, i) : entry
  })
}

/**
 * The course's flow, session by session: the one syllabus the course page and
 * the course space both show. Sessions are edited in their own documents,
 * not on the page, so only the course's own line carries an editor mark.
 *
 * `decorate` lets a caller change an entry (a space adds counts to it) without
 * copying how the entries are built.
 */
export function CourseSyllabus({
  course,
  sessions,
  editable = false,
  decorate,
  className,
}: {
  course: SyllabusCourse
  sessions: readonly NumberedSession<SyllabusSession>[]
  editable?: boolean
  decorate?: (entry: SyllabusEntry, index: number) => SyllabusEntry
  className?: string
}) {
  const pe = editableIn(editable)
  const t = useTranslations('Course')
  const format = useFormatter()
  const locale = useLocale()
  const entries = useSyllabusEntries(course, sessions, decorate)
  if (!entries.length) return null

  const monthName = (month: string, width: 'long' | 'short') =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), {
      month: width,
      year: 'numeric',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })

  // Months as the sessions first introduce them, closest to oldest.
  const monthKeys: string[] = []
  for (const entry of entries) if (!monthKeys.includes(entry.month)) monthKeys.push(entry.month)
  const groups: SyllabusGroup[] = monthKeys.map((month) => ({
    key: month,
    label: month ? monthName(month, 'long') : t('feedUnscheduled'),
    short: month ? monthName(month, 'short').split(' ')[0]! : '·',
  }))
  const firstBodyId = entries.find((entry) => entry.body)?.id
  return (
    <SyllabusFeed
      entries={entries}
      groups={groups}
      title={t('flow')}
      subtitle={course.syllabus_tentative ? t('tentative') : undefined}
      headerAttrs={course.syllabus_tentative ? { subtitle: pe('syllabus_tentative') } : undefined}
      defaultOpen={firstBodyId ? [firstBodyId] : []}
      openAll={editable}
      numberingSystem={numberingSystemOf(locale)}
      className={className}
    />
  )
}

/**
 * One session of a course as its syllabus shows it, open: a post that points
 * at the session renders it from the course's live data. Null when the
 * course no longer has that session.
 */
export function CourseSession({
  course,
  sessions,
  session,
  label,
  footer,
}: {
  course: SyllabusCourse
  sessions: readonly NumberedSession<SyllabusSession>[]
  /** The id of the session to show */
  session: string
  /** What the card is named for assistive tech */
  label: string
  /** Closes the card's details, after the materials and activities */
  footer?: ReactNode
}) {
  const entry = useSyllabusEntries(course, sessions).find((e) => e.id === session)
  if (!entry) return null
  const body =
    footer && !entry.cancelled ? (
      <div className="grid gap-5">
        {entry.body}
        {footer}
      </div>
    ) : (
      entry.body
    )
  return <SyllabusSession entry={{ ...entry, body }} label={label} />
}

/** One session's own text, materials and activities: the syllabus feed opens it. */
function SessionBody({
  session,
  dir,
  lang,
}: {
  session: SyllabusSession
  dir: 'ltr' | 'rtl'
  lang: string
}) {
  const t = useTranslations('Course')
  const materials = session.bibliography ?? []
  const activities = session.activities ?? []
  return (
    <div className="grid gap-5" dir={dir} lang={lang}>
      {session.description ?? null}
      {materials.length ? <MaterialList items={materials} path="" pe={editableIn(false)} /> : null}
      {activities.length ? (
        <div>
          <p className="text-xs text-(--text-muted)">{t('activities')}</p>
          {/* Laid out as the materials are: the kind's icon in its own column. */}
          <ul className="mt-2 grid gap-2.5">
            {activities.map((a, j) => {
              const Icon = ACTIVITY_ICONS[a.kind] ?? Shapes
              return (
                <li
                  className="grid grid-cols-[1.25rem_1fr] gap-x-3 text-sm leading-snug"
                  dir="auto"
                  key={a.id ?? j}
                >
                  <Icon
                    aria-hidden
                    className="mt-0.5 text-(--text-muted)"
                    size={16}
                    strokeWidth={1.5}
                  />
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
export function MaterialList({
  items,
  path,
  pe,
}: {
  items: Material[]
  path: string
  pe: Editable
}) {
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
