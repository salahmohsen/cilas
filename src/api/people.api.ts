import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { Payload } from 'payload'

import type { Locale } from '@/api/articles.api'
import type { Article, Course, Person } from '@/payload-types'

const otherLocale = (locale: Locale): Locale => (locale === 'ar' ? 'en' : 'ar')

/**
 * A person as a visitor sees them. Name and bio fall back to the other
 * language when missing in the site language (CONTENT language rule). Joins
 * stay off: they hold enrollments and memberships, which are not public.
 */
export const getPerson = async (payload: Payload, slug: string, locale: Locale): Promise<Person | undefined> => {
  const { docs } = await payload.find({
    collection: 'people',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    joins: false,
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
  })
  return docs[0]
}

export type Credit = { article: Article; role: string; label?: string | null }

export type Contributions = {
  /** Articles the person wrote (or whose original they wrote). */
  written: Article[]
  /** Articles the person translated, edited or otherwise worked on. */
  credited: Credit[]
  /** Published public courses the person taught. */
  taught: Course[]
}

/**
 * What a person has contributed that a visitor may see: published articles
 * they wrote or are credited on, and published courses they taught.
 */
export const getContributions = async (payload: Payload, personId: number, locale: Locale): Promise<Contributions> => {
  const query = { locale, fallbackLocale: otherLocale(locale), overrideAccess: false, depth: 2, limit: 100 } as const
  const [byAuthor, byOriginal, byCredit, courses] = await Promise.all([
    payload.find({ collection: 'articles', where: { and: [{ authors: { in: [personId] } }, { _status: { equals: 'published' } }] }, sort: '-published_date', ...query }),
    payload.find({
      collection: 'articles',
      where: { and: [{ 'translation.original_authors': { in: [personId] } }, { _status: { equals: 'published' } }] },
      sort: '-published_date',
      ...query,
    }),
    payload.find({ collection: 'articles', where: { and: [{ 'credits.people': { in: [personId] } }, { _status: { equals: 'published' } }] }, sort: '-published_date', ...query }),
    payload.find({
      collection: 'courses',
      where: { and: [{ fellows: { in: [personId] } }, { _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
      sort: '-createdAt',
      joins: false,
      ...query,
      depth: 1,
    }),
  ])

  const written = [...byAuthor.docs]
  for (const a of byOriginal.docs) if (!written.some((w) => w.id === a.id)) written.push(a)

  const credited: Credit[] = []
  for (const article of byCredit.docs) {
    for (const c of article.credits ?? []) {
      const named = c.people.some((p) => (typeof p === 'object' ? p.id : p) === personId)
      if (named && !credited.some((x) => x.article.id === article.id && x.role === c.role)) {
        credited.push({ article, role: c.role, label: c.label })
      }
    }
  }

  return { written, credited, taught: courses.docs }
}

export type FellowCourse = { slug: string; title: string; season: string | null; year: number | null; start: string }
export type Fellow = {
  id: number
  slug: string
  name: string
  photo?: { url: string; alt: string }
  /** The bio as plain text, in the site language (or its own). */
  bio: string
  /** What they taught here, newest first. */
  courses: FellowCourse[]
}

/**
 * CILAS's fellows: everyone who taught a published course, the most recent
 * teachers first, each with the courses they taught.
 */
export const getFellows = async (payload: Payload, locale: Locale): Promise<Fellow[]> => {
  const { docs } = await payload.find({
    collection: 'courses',
    where: { and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }] },
    depth: 2,
    joins: false,
    pagination: false,
    select: { title: true, slug: true, fellows: true, cycle: true, schedule: true },
    populate: {
      people: { name: true, slug: true, photo: true, bio: true },
      media: { url: true, alt: true, filename: true, prefix: true },
      cycles: { season: true, start_year: true, start_date: true },
    },
    locale,
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
    overrideAccess: false,
  })

  const fellows = new Map<number, Fellow>()
  for (const c of docs) {
    const cycle = typeof c.cycle === 'object' && c.cycle ? c.cycle : null
    const course: FellowCourse = {
      slug: c.slug ?? String(c.id),
      title: c.title,
      season: cycle?.season ?? null,
      year: cycle?.start_year ?? null,
      start: c.schedule?.start_date ?? cycle?.start_date ?? `${cycle?.start_year ?? 0}`,
    }
    for (const f of c.fellows ?? []) {
      if (typeof f !== 'object' || !f?.slug) continue
      const known = fellows.get(f.id)
      if (known) {
        known.courses.push(course)
        continue
      }
      const photo = typeof f.photo === 'object' && f.photo?.url ? f.photo : null
      fellows.set(f.id, {
        id: f.id,
        slug: f.slug,
        name: f.name,
        ...(photo ? { photo: { url: photo.url!, alt: photo.alt ?? f.name } } : {}),
        bio: f.bio ? convertLexicalToPlaintext({ data: f.bio }).replace(/\s+/g, ' ').trim() : '',
        courses: [course],
      })
    }
  }
  const latest = (f: Fellow) => f.courses.reduce((m, c) => (c.start > m ? c.start : m), '')
  return [...fellows.values()]
    .map((f) => ({ ...f, courses: f.courses.sort((a, b) => b.start.localeCompare(a.start)) }))
    .sort((a, b) => latest(b).localeCompare(latest(a)) || a.name.localeCompare(b.name))
}
