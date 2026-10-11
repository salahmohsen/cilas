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
