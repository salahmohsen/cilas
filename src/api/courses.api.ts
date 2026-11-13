import { siteTiers } from '@/access'
import type { Reader } from '@/lib/reader'
import { type Locale, otherLocale } from '@/i18n/routing'
import { listSeparator } from '@/lib/locale-format'
import { mediaPopulate, mediaStudyImage } from '@/lib/media-image'
import { detailPath } from '@/lib/paths'
import { plainText } from '@/lib/plaintext'
import { previewWhere } from '@/lib/preview-access'
import { isRelation as isObj, relation as obj, relId } from '@/lib/relation'
import type { Payload, Where } from 'payload'

import type { SiteTier } from '@/access'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { searchWords, type StudyCourse } from '@/lib/course-search'
import { SEASONS } from '@/lib/cycle'
import { localDigits } from '@/lib/digits'
import { courseRegistration } from '@/lib/registration'
import { slugify } from '@/lib/slugify'
import type { Course, Cycle, Media, Person, Place, Session } from '@/payload-types'

/**
 * What a course's relations bring along: enough to name and picture them.
 * Without it, depth 2 also loads each fellow's and cycle's joined courses.
 */
const populate = {
  people: { name: true, slug: true },
  cycles: {
    title: true,
    season: true,
    start_year: true,
    start_date: true,
    academic_year: true,
    place: true,
    registration: true,
  },
  places: { name: true, city: true, slug: true },
  media: mediaPopulate,
} as const

/**
 * The gate of every read here. The study index is cached for all readers of
 * a tier set, so it reads with no user and `visible` alone decides.
 */
const visible = (tiers: SiteTier[]): Where => ({
  and: [{ tier: { in: tiers } }, { _status: { equals: 'published' } }],
})

/**
 * A course's sessions come along through its `syllabus` join, for their
 * words; its other joins are admin views and stay behind.
 */
const withSessions = { enrollments: false, syllabus: { limit: 0 } } as const

/**
 * Published courses in these tiers. Drafts (imported courses awaiting review
 * among them) stay off the list, matching what `/study/<slug>` will show.
 */
const getListedCourses = async (payload: Payload, locale: Locale, tiers: SiteTier[]) =>
  payload.find({
    collection: 'courses',
    where: visible(tiers),
    depth: 2,
    populate,
    joins: withSessions,
    pagination: false,
    overrideAccess: true,
    locale,
    // A course without text in the site language shows its own (CONTEXT.md).
    fallbackLocale: otherLocale(locale),
  })

const plain = (data: unknown): string =>
  data && typeof data === 'object' && 'root' in data
    ? plainText({ data: data as Parameters<typeof plainText>[0]['data'] })
    : ''

const courseTexts = (c: Course): string[] => [
  c.title,
  c.subtitle ?? '',
  c.summary ?? '',
  c.epigraph ?? '',
  plain(c.description),
  c.facilitator_note ?? '',
  c.language_note ?? '',
  ...(c.fellows ?? []).map((f) => obj<Person>(f)?.name ?? ''),
  ...(c.syllabus?.docs ?? [])
    .filter(isObj<Session>)
    .flatMap((s) => [
      s.title ?? '',
      s.description ?? '',
      ...(s.bibliography ?? []).flatMap((b) => [b.title ?? '', b.note ?? '']),
      ...(s.activities ?? []).map((a) => a.description ?? ''),
    ]),
  ...(c.bibliography ?? []).flatMap((b) => [b.title ?? '', b.note ?? '']),
]

/**
 * The study list: published courses in these tiers, newest cycle first, each with
 * its filter values labelled in the site language and its search words from
 * both languages, so a reader finds a course by any name it goes by.
 */
export const getStudyCourses = async (
  payload: Payload,
  locale: Locale,
  t: (key: string) => string,
  tiers: SiteTier[],
): Promise<StudyCourse[]> => {
  const other: Locale = otherLocale(locale)
  const [{ docs }, { docs: otherDocs }, { docs: places }] = await Promise.all([
    getListedCourses(payload, locale, tiers),
    payload.find({
      collection: 'courses',
      where: visible(tiers),
      depth: 1,
      populate,
      joins: withSessions,
      pagination: false,
      overrideAccess: true,
      locale: other,
      fallbackLocale: false,
    }),
    // A place is its city, keyed in English so the list's URL works in both languages.
    payload.find({
      collection: 'places',
      depth: 0,
      pagination: false,
      locale: 'en',
      select: { city: true, name: true },
    }),
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
        ? [`${t(`seasons.${season}`)} ${localDigits(cycle.start_year, locale)}`, place]
            .filter(Boolean)
            .join(listSeparator(locale))
        : null
      const type = c.course_type
      const fellows = (c.fellows ?? []).flatMap((f) => {
        const p = obj<Person>(f)
        return p ? [{ value: p.slug ?? String(p.id), label: p.name }] : []
      })
      const formats = (c.location ?? []).map((l) => ({
        value: l.toLowerCase(),
        label: t(`formats.${l.toLowerCase()}`),
      }))
      const languages = (c.teaching_languages ?? []).map((l) => ({
        value: l,
        label: t(`languages.${l}`),
      }))
      const description = c.summary || c.subtitle || plain(c.description) || undefined

      // Open or closed today; the index is rebuilt every few minutes, so it follows deadlines.
      const resolved = courseRegistration(c, cycle)
      const registration = resolved.status
      const facets: StudyCourse['facets'] = {
        registration: [
          {
            value: registration,
            label: t(`registration.${registration}`),
            rank: registration === 'open' ? 0 : 1,
          },
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
              season: [
                { value: season, label: t(`seasons.${season}`), rank: SEASONS.indexOf(season) },
              ],
              year: [
                { value: String(cycle.start_year), label: localDigits(cycle.start_year, locale) },
              ],
              ...(cycle.academic_year
                ? {
                    academic: [
                      {
                        value: cycle.academic_year.replace('–', '-'),
                        label: localDigits(cycle.academic_year, locale),
                      },
                    ],
                  }
                : {}),
            }
          : {}),
        ...(site && place
          ? { place: [{ value: placeKey.get(site.id) ?? String(site.id), label: place }] }
          : {}),
        fellow: fellows,
        format: formats,
        language: languages,
      }

      return {
        id: c.id,
        href: detailPath('courses', String(c.slug), locale),
        title: c.title,
        sublabel: [typeLabel(type), cycleLabel].filter(Boolean).join(' · '),
        description:
          description && description.length > 280
            ? `${description.slice(0, 277).trimEnd()}…`
            : description,
        ...mediaStudyImage(cover),
        // Days: the first meeting's, else the cycle's.
        startDate: c.first_day ?? cycle?.start_date?.slice(0, 10) ?? `${cycle?.start_year ?? 0}`,
        ...(resolved.deadline ? { deadline: resolved.deadline } : {}),
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

/**
 * A course the site shows `reader`: published, in a tier they may see. An
 * owner-only course shows only in the admin's preview.
 */
export const courseWhere = (reader: Reader, slug: string): Where => ({
  and: [
    { slug: { equals: slug } },
    { tier: { in: siteTiers(reader) } },
    { _status: { equals: 'published' } },
  ],
})

export const getCourse = async (
  payload: Payload,
  slug: string,
  { locale, reader, depth = 2 }: { locale: Locale; reader: Reader; depth?: number },
) => {
  const { docs } = await payload.find({
    collection: 'courses',
    where: courseWhere(reader, slug),
    limit: 1,
    depth,
    joins: false,
    overrideAccess: false,
    user: reader,
    locale,
    fallbackLocale: otherLocale(locale),
  })
  return docs[0]
}
export const getCourseForReading = async (
  payload: Payload,
  slug: string,
  { locale, reader, preview = false }: { locale: Locale; reader: Reader; preview?: boolean },
) => {
  // Draft mode outlives the preview that set it: a course the reader may not
  // edit reads as published.
  const scope = preview ? await previewWhere(payload, 'courses', reader) : false
  const readEditable = async (where: Where, draft: boolean): Promise<Course | undefined> =>
    (
      await payload.find({
        collection: 'courses',
        // The admin's preview shows any course; the site only what the reader may see.
        where: { and: [{ slug: { equals: slug } }, where] },
        limit: 1,
        // Must match the `depth` given to `useLivePreview` in CourseLivePreview,
        // or populated relationships will not survive the live merge.
        depth: 2,
        // Joins are admin views (a course's enrollments, a cycle's courses); never
        // ship them to the page, where a previewing fellow would see assessments.
        joins: false,
        overrideAccess: false,
        user: reader,
        draft,
        // A course without text in the site language shows its own (CONTEXT.md).
        locale: locale as 'en' | 'ar',
        fallbackLocale: otherLocale(locale),
      })
    ).docs[0]
  const editable = scope === false ? undefined : await readEditable(scope, false)
  /*
   * `draft: true` is what returns the in-progress version. It reads from the
   * versions table, and a document that has never been saved as a draft has
   * no row there: the published document is the only record. So fall back to
   * the plain read, otherwise previewing any freshly published course 404s
   * until something triggers a version write.
   */
  const previewCourse =
    scope === false || !editable ? undefined : ((await readEditable(scope, true)) ?? editable)

  const course = editable ?? (await getCourse(payload, slug, { locale, reader }))

  if (!course) return undefined

  const cycleId = relId(course.cycle) ?? undefined
  const { docs: siblings } = cycleId
    ? await payload.find({
        collection: 'courses',
        where: {
          and: [
            { cycle: { equals: cycleId } },
            { id: { not_equals: course.id } },
            { tier: { in: siteTiers(reader) } },
            { _status: { equals: 'published' } },
          ],
        },
        depth: 1,
        joins: false,
        pagination: false,
        populate: {
          people: { name: true },
          media: mediaPopulate,
        },
        select: { title: true, slug: true, course_type: true, fellows: true, cover_image: true },
        locale: locale as 'en' | 'ar',
        fallbackLocale: otherLocale(locale),
      })
    : { docs: [] }
  return { course, siblings, previewCourse }
}
