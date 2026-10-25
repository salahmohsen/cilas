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
import React from 'react'

import {
  SyllabusFeed,
  type SyllabusEntry,
  type SyllabusGroup,
} from '@/components/arc/blocks/syllabus-feed/syllabus-feed'
import { RichTextField } from '@/components/RichTextField'
import { localDigits, numberingSystemOf } from '@/lib/digits'
import { editableIn, type Editable } from '@/lib/editable'
import { expandSchedule, sessionsInOrder } from '@/lib/schedule'
import type { Course } from '@/payload-types'

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

export const isObject = <T,>(v: unknown): v is T => typeof v === 'object' && v !== null

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

/**
 * The course's flow, session by session: the one syllabus the course page and
 * the course space both show. Each session carries its first meeting, its
 * month, its facet kinds and its text, rendered here once; the visual
 * editor's marks travel as plain data into the client component.
 *
 * `decorate` lets a caller change an entry (a space adds counts to it) without
 * copying how the entries are built.
 */
export function CourseSyllabus({
  course,
  editable = false,
  decorate,
  className,
}: {
  course: Course
  editable?: boolean
  decorate?: (entry: SyllabusEntry, index: number) => SyllabusEntry
  className?: string
}) {
  const pe = editableIn(editable)
  const t = useTranslations('Course')
  const format = useFormatter()
  const locale = useLocale()

  const dir = directionOf(`${course.title} ${course.subtitle ?? ''} ${textOf(course.description)}`)
  const lang = dir === 'rtl' ? 'ar' : 'en'
  const sessions = sessionsInOrder(course.sessions ?? [])
  const meetings = expandSchedule(course.schedule, course.sessions)
  if (!sessions.length) return null

  /** "Tue 3 Mar". Days are Cairo calendar days, so format them in UTC. */
  const dayLabel = (day: string): string =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })
  const unitLabel = (n: number) =>
    course.session_unit === 'week' ? t('week', { number: n }) : t('session', { number: n })
  const monthName = (month: string, width: 'long' | 'short') =>
    format.dateTime(new Date(`${month}-01T00:00:00Z`), {
      month: width,
      year: 'numeric',
      timeZone: 'UTC',
      numberingSystem: numberingSystemOf(locale),
    })

  const entries: SyllabusEntry[] = sessions.map((session, i) => {
    // Sessions show in their `order`; the editor needs their place in the data.
    const at = Math.max(
      0,
      (course.sessions ?? []).findIndex((s) => s.id === session.id),
    )
    const own = meetings.filter((m) => m.session === i + 1)
    const materials = session.bibliography ?? []
    const activities = session.activities ?? []
    const hasBody = Boolean(session.description || materials.length || activities.length)
    const first = own.find((m) => !m.cancelled) ?? own[0]
    const date = first?.date
    const entry: SyllabusEntry = {
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
          <SessionBody
            session={session}
            at={at}
            pe={pe}
            editable={editable}
            dir={dir}
            lang={lang}
          />
        ) : undefined,
      attrs: {
        row: pe(`sessions.${at}`, { row: { id: session.id } }),
        title: pe(`sessions.${at}.session_title`),
        meta: pe(`sessions.${at}.dates`),
      },
    }
    return decorate ? decorate(entry, i) : entry
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
      containerAttrs={pe.container('sessions')}
      className={className}
    />
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
          <RichTextField
            className="article-prose article-prose--notes"
            data={session.description}
          />
        </div>
      ) : editable ? (
        // Something to double-click while the session has no text yet.
        <p
          className="text-sm text-(--text-muted)"
          dir="ltr"
          lang="en"
          {...pe(`sessions.${at}.description`)}
        >
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
