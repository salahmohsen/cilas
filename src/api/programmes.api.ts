import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { Payload } from 'payload'

import type { Course, Cycle, Media, Person, Programme } from '@/payload-types'

type Locale = 'en' | 'ar'

const obj = <T,>(v: unknown): T | null => (typeof v === 'object' && v !== null ? (v as T) : null)

const plain = (data: unknown): string =>
  data && typeof data === 'object' && 'root' in data
    ? convertLexicalToPlaintext({ data: data as Parameters<typeof convertLexicalToPlaintext>[0]['data'] })
    : ''
const clip = (text: string, max = 220) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** A course as the programme page shows it: a card with its cover, words and fellows. */
export type ProgrammeCourse = {
  id: number
  slug: string
  title: string
  type: Course['course_type']
  /** Its summary, or the start of its description. */
  excerpt: string
  image: { src: string; alt: string } | null
  /** ISO day the course starts (its cycle's start when it has no date). */
  startDate: string
  fellows: Array<{ name: string; avatar: string | null }>
}

/** A part of the year: its label and note, its cycle, and the courses it draws. */
export type ProgrammePart = {
  label: string
  description: string | null
  cycle: Cycle
  courses: ProgrammeCourse[]
}

export type BridgeYear = {
  programme: Programme
  cover: Media | null
  /** The parts in order, grouped by their cycle (a semester). */
  semesters: Array<{ cycle: Cycle; parts: ProgrammePart[] }>
  /** How many people the year's community counts. */
  members: number
}

/**
 * The current Bridge year: the latest published Bridge programme, with each of
 * its components' courses worked out from its cycle (ADR 0003 — a programme
 * never stores its courses).
 */
export const getBridgeYear = async (payload: Payload, locale: Locale): Promise<BridgeYear | null> => {
  const { docs } = await payload.find({
    collection: 'programmes',
    where: { and: [{ kind: { equals: 'bridge' } }, { _status: { equals: 'published' } }] },
    // Titles carry the years ("Bridge Programme 2025–2026"), so the latest sorts first.
    sort: '-title',
    limit: 1,
    depth: 1,
    locale,
    fallbackLocale: 'en',
  })
  const programme = docs[0]
  if (!programme) return null

  const parts = await Promise.all(
    (programme.components ?? []).map(async (component): Promise<ProgrammePart | null> => {
      const cycle = obj<Cycle>(component.cycle)
      if (!cycle) return null
      const { docs: courses } = await payload.find({
        collection: 'courses',
        where: {
          and: [
            { cycle: { equals: cycle.id } },
            { course_type: { in: component.course_types } },
            { tier: { equals: 'public' } },
            { _status: { equals: 'published' } },
          ],
        },
        sort: 'title',
        limit: 0,
        depth: 2,
        locale,
        fallbackLocale: 'en',
        select: {
          slug: true,
          title: true,
          course_type: true,
          fellows: true,
          cover_image: true,
          summary: true,
          subtitle: true,
          description: true,
          schedule: true,
        },
        populate: { people: { name: true, photo: true } },
      })
      return {
        label: component.label,
        description: component.description ?? null,
        cycle,
        courses: courses
          .map((c): ProgrammeCourse => {
            const cover = obj<Media>(c.cover_image)
            return {
              id: c.id,
              slug: c.slug ?? String(c.id),
              title: c.title,
              type: c.course_type,
              excerpt: clip(c.summary || c.subtitle || plain(c.description)),
              image: cover?.url ? { src: cover.url, alt: cover.alt ?? '' } : null,
              startDate: (c.schedule?.start_date ?? cycle.start_date ?? `${cycle.start_year}-01-01`).slice(0, 10),
              fellows: (c.fellows ?? []).flatMap((f) => {
                const person = obj<Person>(f)
                if (!person?.name) return []
                const photo = obj<Media>(person.photo)
                return [{ name: person.name, avatar: photo?.sizes?.thumbnail?.url ?? photo?.url ?? null }]
              }),
            }
          })
          // The part's courses in the order they start.
          .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title)),
      }
    }),
  )

  const semesters: BridgeYear['semesters'] = []
  for (const part of parts) {
    if (!part) continue
    const last = semesters.at(-1)
    if (last && last.cycle.id === part.cycle.id) last.parts.push(part)
    else semesters.push({ cycle: part.cycle, parts: [part] })
  }

  const { totalDocs: members } = await payload.count({
    collection: 'memberships',
    where: { programme: { equals: programme.id } },
  })

  return { programme, cover: obj<Media>(programme.cover), semesters, members }
}
