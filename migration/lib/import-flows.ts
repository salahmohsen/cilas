import type { Payload } from 'payload'

import { lexical } from '../../seed/seed.utils'
import { isMostlyArabic } from './normalise-courses'
import type { Syllabus } from './syllabus-schema'

export type FlowEntry = { id: string; courses: string[] }

/** The heading paragraph over a flow's notes in the course description. */
export const NOTES_HEADING = 'Course flow notes'

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

/** The description with the flow's notes appended, or null when nothing changes. */
const withNotes = (description: Lexical | null | undefined, notes: string | null, dir: 'ltr' | 'rtl'): Lexical | null => {
  if (!notes?.trim()) return null
  if (description && textOf(description).includes(NOTES_HEADING)) return null
  const block = lexical([NOTES_HEADING, ...paragraphs(notes)], dir)
  if (!description?.root) return block
  return { ...description, root: { ...description.root, children: [...description.root.children, ...block.root.children] } }
}

const materialShape = (m: Material, text: boolean, id?: string | null) => ({
  ...(id ? { id } : {}),
  type: m.type,
  href: m.href,
  ...(text ? { title: m.title, note: m.note } : {}),
})

/**
 * Writes each flow's syllabus into its courses' sessions and bibliography.
 * Drafts throughout; courses marked `reviewed` are never touched, and a re-run
 * replaces the sessions rather than adding to them.
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
    const syllabus = syllabi.get(flow.id)
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
      const description = withNotes(course.description, syllabus.notes, dir)

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
          },
          locale: 'ar',
          draft: true,
          overrideAccess: true,
        } as Parameters<Payload['update']>[0])
      }

      written++
      sessions += syllabus.sessions.length
    }
  }

  return { courses: written, sessions, skipped }
}
