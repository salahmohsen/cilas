import { plainText } from '@/lib/plaintext'
import type { Payload, Where } from 'payload'

import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { SEASONS } from '@/lib/cycle'
import { localDigits } from '@/lib/digits'
import { registrationStatus } from '@/lib/registration'
import { slugify } from '@/lib/slugify'
import { searchWords, type StudyCourse } from '@/lib/course-search'
import type { Course, Cycle, Media, Person, Place } from '@/payload-types'

type Locale = 'en' | 'ar'

/**
 * What a course's relations bring along: enough to name and picture them.
 * Without it, depth 2 also loads each fellow's and cycle's joined courses.
 */
const populate = {
  people: { name: true, slug: true },
  cycles: { title: true, season: true, start_year: true, start_date: true, academic_year: true, place: true, registration: true },
  places: { name: true, city: true, slug: true },
  media: { url: true, alt: true, filename: true, prefix: true },
} as const

const visible: Where = { and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }] }

/**
 * Published public courses. Drafts (imported courses awaiting review among
 * them) stay off the list, matching what `/study/<slug>` will show.
 */
export const getPublicPosts = async (payload: Payload, locale: Locale = 'en') =>
  payload.find({
    collection: 'courses',
    where: visible,
    depth: 2,
    populate,
    joins: false,
    pagination: false,
    overrideAccess: false,
    locale,
    // A course without text in the site language shows its own (CONTEXT.md).
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
  })

const plain = (data: unknown): string =>
  data && typeof data === 'object' && 'root' in data
    ? plainText({ data: data as Parameters<typeof plainText>[0]['data'] })
    : ''

const obj = <T>(value: unknown): T | null => (value && typeof value === 'object' ? (value as T) : null)

/** Every text a course has in one locale: what the search reads. */
const courseTexts = (c: Course): string[] => [
  c.title,
  c.subtitle ?? '',
  c.summary ?? '',
  c.epigraph ?? '',
  plain(c.description),
  c.facilitator_note ?? '',
  c.language_note ?? '',
  ...(c.fellows ?? []).map((f) => obj<Person>(f)?.name ?? ''),
  ...(c.sessions ?? []).flatMap((s) => [
    s.session_title ?? '',
    plain(s.description),
    ...(s.bibliography ?? []).flatMap((b) => [b.title ?? '', b.note ?? '']),
    ...(s.activities ?? []).map((a) => a.description ?? ''),
  ]),
  ...(c.bibliography ?? []).flatMap((b) => [b.title ?? '', b.note ?? '']),
]

/**
 * The study list: published public courses, newest cycle first, each with
 * its filter values labelled in the site language and its search words from
 * both languages, so a reader finds a course by any name it goes by.
 */
export const getStudyCourses = async (
  payload: Payload,
  locale: Locale,
  t: (key: string) => string,
): Promise<StudyCourse[]> => {
  const other: Locale = locale === 'ar' ? 'en' : 'ar'
  const [{ docs }, { docs: otherDocs }, { docs: places }] = await Promise.all([
    getPublicPosts(payload, locale),
    payload.find({
      collection: 'courses',
      where: visible,
      depth: 1,
      populate,
      joins: false,
      pagination: false,
      overrideAccess: false,
      locale: other,
      fallbackLocale: false,
    }),
    // A place is its city, keyed in English so the list's URL works in both languages.
    payload.find({ collection: 'places', depth: 0, pagination: false, locale: 'en', select: { city: true, name: true } }),
  ])
  const placeKey = new Map(places.map((s) => [s.id, slugify(s.city ?? s.name)]))
  const otherTexts = new Map(otherDocs.map((d) => [d.id, courseTexts(d)]))

  const typeLabel = (value: string) => t(`types.${value.toLowerCase()}`)

  return docs
    .map((c): StudyCourse => {
      const cycle = obj<Cycle>(c.cycle)
      const site = obj<Place>(cycle?.place)
      const cover = obj<Media>(c.cover_image)
      const place = site ? (site.city ?? site.name) : null
      const season = cycle?.season
      const cycleLabel = cycle
        ? [`${t(`seasons.${season}`)} ${localDigits(cycle.start_year, locale)}`, place].filter(Boolean).join(locale === 'ar' ? '، ' : ', ')
        : null
      const type = c.course_type
      const fellows = (c.fellows ?? []).flatMap((f) => {
        const p = obj<Person>(f)
        return p ? [{ value: p.slug ?? String(p.id), label: p.name }] : []
      })
      const formats = (c.location ?? []).map((l) => ({ value: l.toLowerCase(), label: t(`formats.${l.toLowerCase()}`) }))
      const languages = (c.teaching_languages ?? []).map((l) => ({ value: l, label: t(`languages.${l}`) }))
      const description = c.summary || c.subtitle || plain(c.description) || undefined

      // Open or closed today; the index is rebuilt every few minutes, so it follows deadlines.
      const registration = registrationStatus(c.registration, cycle?.registration)
      const facets: StudyCourse['facets'] = {
        registration: [
          { value: registration, label: t(`registration.${registration}`), rank: registration === 'open' ? 0 : 1 },
        ],
        type: [
          {
            value: type.toLowerCase(),
            label: typeLabel(type),
            rank: COURSE_TYPE_OPTIONS.findIndex((o) => o.value === type),
          },
        ],
        ...(cycle && season
          ? {
              season: [{ value: season, label: t(`seasons.${season}`), rank: SEASONS.indexOf(season) }],
              year: [{ value: String(cycle.start_year), label: localDigits(cycle.start_year, locale) }],
              ...(cycle.academic_year
                ? { academic: [{ value: cycle.academic_year.replace('–', '-'), label: localDigits(cycle.academic_year, locale) }] }
                : {}),
            }
          : {}),
        ...(site && place ? { place: [{ value: placeKey.get(site.id) ?? String(site.id), label: place }] } : {}),
        fellow: fellows,
        format: formats,
        language: languages,
      }

      return {
        id: c.id,
        href: `/${locale}/study/${c.slug}`,
        title: c.title,
        sublabel: [typeLabel(type), cycleLabel].filter(Boolean).join(' · '),
        description: description && description.length > 280 ? `${description.slice(0, 277).trimEnd()}…` : description,
        image: cover?.url ?? undefined,
        imageAlt: cover?.alt ?? undefined,
        startDate: c.schedule?.start_date ?? cycle?.start_date ?? `${cycle?.start_year ?? 0}`,
        ...((c.registration?.deadline ?? cycle?.registration?.deadline)
          ? { deadline: (c.registration?.deadline ?? cycle?.registration?.deadline)!.slice(0, 10) }
          : {}),
        facets,
        words: searchWords([
          ...courseTexts(c),
          ...(otherTexts.get(c.id) ?? []),
          cycle?.title,
          cycleLabel,
          ...Object.values(facets).flatMap((values) => (values ?? []).map((v) => v.label)),
        ]),
      }
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
}
