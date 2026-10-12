import type { Payload } from 'payload'

import { lexical } from '../../seed/seed.utils'
import { splitBios, withSubject, type FlowBio } from './flow-notes'
import { publishCourse } from './import-courses'
import { isMostlyArabic } from './normalise-courses'
import type { Syllabus } from './syllabus-schema'

export type FlowEntry = { id: string; courses: string[] }

/** The heading paragraph that earlier imports put over a flow's notes in the course description. */
export const NOTES_HEADING = 'Course flow notes'
export const NOTES_HEADING_AR = 'ملاحظات مسار المقرر'

/**
 * Some PDFs store Arabic as display-only letter shapes (presentation forms).
 * Map just those code points to ordinary letters; other text is untouched.
 */
export const fixArabicForms = (text: string): string =>
  text.replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]+/g, (run) => run.normalize('NFKC'))

const fixStrings = <T>(value: T): T =>
  (typeof value === 'string'
    ? fixArabicForms(value)
    : Array.isArray(value)
      ? value.map(fixStrings)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixStrings(v)]))
        : value) as T

type Material = Syllabus['bibliography'][number]
type Locale = 'en' | 'ar'
type Lexical = ReturnType<typeof lexical>
type Row = { id?: string | null }
type StoredSession = Row & { bibliography?: Row[] | null; activities?: Row[] | null }
type StoredCourse = {
  id: number
  import_status?: string | null
  description?: Lexical | null
  sessions?: StoredSession[] | null
  bibliography?: Row[] | null
  fellows?: number[] | null
}

const paragraphs = (text: string): string[] => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
const rich = (text: string, dir: 'ltr' | 'rtl'): Lexical | null =>
  paragraphs(text).length ? lexical(paragraphs(text), dir) : null

/** Every piece of text in the syllabus, to tell its language. */
const allText = (s: Syllabus): string =>
  [
    ...s.sessions.flatMap((x) => [
      x.title ?? '',
      x.description,
      ...x.materials.flatMap((m) => [m.title, m.note ?? '']),
      ...x.activities.map((a) => a.description),
    ]),
    ...s.bibliography.flatMap((m) => [m.title, m.note ?? '']),
    s.notes ?? '',
  ].join('\n')

const textOf = (node: unknown): string => {
  if (!node || typeof node !== 'object') return ''
  const n = node as { text?: unknown; children?: unknown[]; root?: unknown }
  if (n.root) return textOf(n.root)
  return [typeof n.text === 'string' ? n.text : '', ...(n.children ?? []).map(textOf)].join('\n')
}

/**
 * The description without the notes an earlier import appended under the
 * notes heading (they now go to `facilitator_note`), or null when it has none.
 */
const withoutNotes = (description: Lexical | null | undefined): Lexical | null => {
  const children = description?.root?.children ?? []
  const at = children.findIndex((n) => {
    const text = textOf(n).trim()
    return text === NOTES_HEADING || text === NOTES_HEADING_AR
  })
  if (!description || at === -1) return null
  return { ...description, root: { ...description.root, children: children.slice(0, at) } }
}

type Fellow = {
  id: number
  names: string[]
  name: Partial<Record<Locale, string>>
  bio: Partial<Record<Locale, unknown>>
  reviewed: boolean
}

/** The course's fellows, with every spelling of their names. */
const fellowsOf = async (payload: Payload, ids: number[]): Promise<Fellow[]> => {
  if (!ids.length) return []
  const { docs } = await payload.find({
    collection: 'people',
    where: { id: { in: ids } },
    depth: 0,
    pagination: false,
    locale: 'all',
    overrideAccess: true,
  })
  return docs.map((d) => {
    const p = d as unknown as { id: number; name?: Record<string, string>; bio?: Record<string, unknown>; import_status?: string | null }
    return {
      id: p.id,
      names: Object.values(p.name ?? {}).filter(Boolean),
      name: (p.name ?? {}) as Fellow['name'],
      bio: (p.bio ?? {}) as Fellow['bio'],
      reviewed: p.import_status === 'reviewed',
    }
  })
}

/**
 * A bio from a flow goes to its fellow's profile, in the flow's language,
 * when the profile has none there yet: a bio from the course page, or one an
 * editor wrote, wins.
 */
const giveBios = async (payload: Payload, bios: FlowBio[], fellows: Fellow[], locale: Locale, dir: 'ltr' | 'rtl') => {
  for (const bio of bios) {
    const fellow = fellows.find((f) => bio.name && f.names.includes(bio.name))
    if (!fellow || fellow.reviewed || textOf(fellow.bio[locale]).trim()) continue
    const body = rich(withSubject(fellow.names[0], bio.text), dir)
    // The name is required in every locale written; one only spelled in the other keeps that spelling.
    const name = fellow.name[locale] ? {} : { name: fellow.names[0] }
    await payload.update({ collection: 'people', id: fellow.id, data: { ...name, bio: body }, locale, overrideAccess: true })
    fellow.bio[locale] = body
  }
}

const materialShape = (m: Material, text: boolean, id?: string | null) => ({
  ...(id ? { id } : {}),
  type: m.type,
  href: m.href,
  ...(text ? { title: m.title, note: m.note } : {}),
})

/**
 * Writes each flow's syllabus into its courses' sessions and bibliography.
 * Written as drafts, then published, like the courses; ones marked
 * `reviewed` are never touched, and a re-run replaces the sessions rather
 * than adding to them.
 *
 * Array rows are shared by both locales, so an Arabic flow is written in two
 * steps: the rows and their non-localized fields in the default locale, then
 * the Arabic text onto the same rows (by id) in the `ar` locale.
 */
export const importFlows = async (
  payload: Payload,
  {
    flows,
    syllabi,
    courses,
  }: {
    flows: FlowEntry[]
    syllabi: Map<string, Syllabus>
    /** The archived courses (seed/data/archive/courses.json); ones with no cycle were never imported. */
    courses: Array<{ legacy_url: string; cycle: string | null }>
  },
): Promise<{ courses: number; sessions: number; skipped: string[] }> => {
  const importable = new Set(courses.filter((c) => c.cycle).map((c) => c.legacy_url))
  const skipped: string[] = []
  let written = 0
  let sessions = 0

  for (const flow of flows) {
    const found = syllabi.get(flow.id)
    const syllabus = found ? fixStrings(found) : undefined
    if (!syllabus) continue
    const locale: Locale = isMostlyArabic(allText(syllabus)) ? 'ar' : 'en'
    const dir = locale === 'ar' ? 'rtl' : 'ltr'
    const english = locale === 'en'

    for (const url of flow.courses) {
      const found = importable.has(url)
        ? (
            await payload.find({
              collection: 'courses',
              where: { legacy_url: { equals: url } },
              limit: 1,
              depth: 0,
              draft: true,
              locale,
              fallbackLocale: false,
              overrideAccess: true,
            })
          ).docs[0]
        : undefined
      const course = found as unknown as StoredCourse | undefined
      if (!course || course.import_status === 'reviewed') {
        skipped.push(url)
        continue
      }
      // The flow's notes are the fellow's note on the course; bios in them go to the fellows.
      const fellows = await fellowsOf(payload, course.fellows ?? [])
      const { notes, bios } = splitBios(syllabus.notes, fellows.map((f) => f.names))
      await giveBios(payload, bios, fellows, locale, dir)
      const description = withoutNotes(course.description)

      // Step A: the rows and their non-localized fields; English text too.
      await payload.update({
        collection: 'courses',
        id: course.id,
        data: {
          session_unit: syllabus.session_unit,
          sessions: syllabus.sessions.map((s) => ({
            order: s.order,
            meetings: s.meetings,
            ...(english ? { session_title: s.title, description: rich(s.description, dir) } : {}),
            bibliography: s.materials.map((m) => materialShape(m, english)),
            activities: s.activities.map((a) => ({ kind: a.kind, ...(english ? { description: a.description } : {}) })),
          })),
          bibliography: syllabus.bibliography.map((m) => materialShape(m, english)),
          ...(english && description ? { description } : {}),
          ...(english ? { facilitator_note: notes } : {}),
        },
        draft: true,
        overrideAccess: true,
      } as Parameters<Payload['update']>[0])

      // Step B: the Arabic text, onto the rows Step A made.
      if (!english) {
        const stored = (await payload.findByID({
          collection: 'courses',
          id: course.id,
          depth: 0,
          draft: true,
          overrideAccess: true,
        })) as unknown as StoredCourse
        const rows = stored.sessions ?? []
        await payload.update({
          collection: 'courses',
          id: course.id,
          data: {
            sessions: syllabus.sessions.map((s, i) => ({
              id: rows[i]?.id,
              order: s.order,
              meetings: s.meetings,
              session_title: s.title,
              description: rich(s.description, dir),
              bibliography: s.materials.map((m, j) => materialShape(m, true, rows[i]?.bibliography?.[j]?.id)),
              activities: s.activities.map((a, j) => ({
                id: rows[i]?.activities?.[j]?.id,
                kind: a.kind,
                description: a.description,
              })),
            })),
            bibliography: syllabus.bibliography.map((m, j) => materialShape(m, true, stored.bibliography?.[j]?.id)),
            ...(description ? { description } : {}),
            facilitator_note: notes,
          },
          locale: 'ar',
          draft: true,
          overrideAccess: true,
        } as Parameters<Payload['update']>[0])
      }

      await publishCourse(payload, course.id)
      written++
      sessions += syllabus.sessions.length
    }
  }

  return { courses: written, sessions, skipped }
}
