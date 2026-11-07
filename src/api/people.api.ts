import { relId } from '@/lib/relation'
import { plainText } from '@/lib/plaintext'
import type { Payload } from 'payload'

import type { Locale } from '@/api/articles.api'
import type { Article, Course, Person } from '@/payload-types'

const otherLocale = (locale: Locale): Locale => (locale === 'ar' ? 'en' : 'ar')

/**
 * A person as a visitor sees them. Name and bio fall back to the other
 * language when missing in the site language (CONTENT language rule). Joins
 * stay off: they hold enrollments and memberships, which are not public.
 */
export const getPerson = async (
  payload: Payload,
  slug: string,
  locale: Locale,
): Promise<Person | undefined> => {
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
export const getContributions = async (
  payload: Payload,
  personId: number,
  locale: Locale,
): Promise<Contributions> => {
  const query = {
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
    depth: 2,
    limit: 100,
  } as const
  const [byAuthor, byOriginal, byCredit, courses] = await Promise.all([
    payload.find({
      collection: 'articles',
      where: { and: [{ authors: { in: [personId] } }, { _status: { equals: 'published' } }] },
      sort: '-published_date',
      ...query,
    }),
    payload.find({
      collection: 'articles',
      where: {
        and: [
          { 'translation.original_authors': { in: [personId] } },
          { _status: { equals: 'published' } },
        ],
      },
      sort: '-published_date',
      ...query,
    }),
    payload.find({
      collection: 'articles',
      where: {
        and: [{ 'credits.people': { in: [personId] } }, { _status: { equals: 'published' } }],
      },
      sort: '-published_date',
      ...query,
    }),
    payload.find({
      collection: 'courses',
      where: {
        and: [
          { fellows: { in: [personId] } },
          { _status: { equals: 'published' } },
          { tier: { equals: 'public' } },
        ],
      },
      sort: '-createdAt',
      joins: false,
      ...query,
    }),
  ])

  const written = [...byAuthor.docs]
  for (const a of byOriginal.docs) if (!written.some((w) => w.id === a.id)) written.push(a)

  const credited: Credit[] = []
  for (const article of byCredit.docs) {
    for (const c of article.credits ?? []) {
      const named = c.people.some((p) => relId(p) === personId)
      if (named && !credited.some((x) => x.article.id === article.id && x.role === c.role)) {
        credited.push({ article, role: c.role, label: c.label })
      }
    }
  }

  return { written, credited, taught: courses.docs }
}

export type FellowCourse = {
  slug: string
  title: string
  season: string | null
  year: number | null
  start: string
}
export type Fellow = {
  id: number
  slug: string
  name: string
  photo?: { url: string; alt: string; focalX?: number | null; focalY?: number | null }
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
        ...(photo
          ? {
              photo: {
                url: photo.url!,
                alt: photo.alt ?? f.name,
                focalX: photo.focalX,
                focalY: photo.focalY,
              },
            }
          : {}),
        bio: f.bio ? plainText({ data: f.bio }).replace(/\s+/g, ' ').trim() : '',
        courses: [course],
      })
    }
  }
  const latest = (f: Fellow) => f.courses.reduce((m, c) => (c.start > m ? c.start : m), '')
  return [...fellows.values()]
    .map((f) => ({ ...f, courses: f.courses.sort((a, b) => b.start.localeCompare(a.start)) }))
    .sort((a, b) => latest(b).localeCompare(latest(a)) || a.name.localeCompare(b.name))
}

type PersonCard = Pick<Fellow, 'id' | 'slug' | 'name' | 'photo' | 'bio'>

const cardOf = (p: Person): PersonCard => {
  const photo = typeof p.photo === 'object' && p.photo?.url ? p.photo : null
  return {
    id: p.id,
    slug: p.slug ?? String(p.id),
    name: p.name,
    ...(photo
      ? {
          photo: {
            url: photo.url!,
            alt: photo.alt ?? p.name,
            focalX: photo.focalX,
            focalY: photo.focalY,
          },
        }
      : {}),
    bio: p.bio ? plainText({ data: p.bio }).replace(/\s+/g, ' ').trim() : '',
  }
}

const personPopulate = {
  people: { name: true, slug: true, photo: true, bio: true },
  media: { url: true, alt: true, filename: true, prefix: true },
} as const

export type CilasianPlace = { role: string; title: string | null; programme: string | null }
export type Cilasian = PersonCard & { places: CilasianPlace[] }

/**
 * CILASians: everyone with a place in a programme's community — students
 * and resident fellows of each Bridge cohort — the newest cohort first.
 * Programmes are drafts until someone confirms their years, but their
 * titles are the archive's own, so they are named here.
 */
export const getCilasians = async (payload: Payload, locale: Locale): Promise<Cilasian[]> => {
  const { docs } = await payload.find({
    collection: 'memberships',
    // The read skips access for the draft programmes' titles, so hidden
    // people (accepted applicants) are left out here.
    where: { 'person.visible': { equals: true } },
    depth: 2,
    pagination: false,
    populate: { ...personPopulate, programmes: { title: true } },
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: true,
  })
  const people = new Map<number, Cilasian>()
  for (const m of docs) {
    if (typeof m.person !== 'object' || !m.person) continue
    const programme = typeof m.programme === 'object' && m.programme ? m.programme.title : null
    const place = { role: m.role, title: m.title ?? null, programme }
    const known = people.get(m.person.id)
    if (known) known.places.push(place)
    else people.set(m.person.id, { ...cardOf(m.person), places: [place] })
  }
  const newest = (c: Cilasian) =>
    c.places
      .map((p) => p.programme ?? '')
      .sort()
      .at(-1) ?? ''
  return [...people.values()]
    .map((c) => ({
      ...c,
      places: c.places.sort((a, b) => (b.programme ?? '').localeCompare(a.programme ?? '')),
    }))
    .sort((a, b) => newest(b).localeCompare(newest(a)) || a.name.localeCompare(b.name))
}

export type GovernanceMember = PersonCard & {
  role: 'advisor' | 'trustee'
  title: string | null
  boardRole: string | null
  advisesOn: string | null
  termFrom: number | null
  termTo: number | null
}

/** The advisors and trustees, in the order an editor gave them. */
export const getGovernance = async (
  payload: Payload,
  locale: Locale,
): Promise<GovernanceMember[]> => {
  const { docs } = await payload.find({
    collection: 'governance',
    depth: 2,
    pagination: false,
    sort: ['order', 'createdAt'],
    populate: personPopulate,
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
  })
  return docs.flatMap((g) =>
    typeof g.person === 'object' && g.person
      ? [
          {
            ...cardOf(g.person),
            role: g.role,
            title: g.title ?? null,
            boardRole: g.board_role ?? null,
            advisesOn: g.advises_on ?? null,
            termFrom: g.term_from ?? null,
            termTo: g.term_to ?? null,
          },
        ]
      : [],
  )
}
