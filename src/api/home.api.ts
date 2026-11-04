import type { Payload, Where } from 'payload'

import { siteTiers } from '@/access'
import { bridgeYearPath, listBridgeYears } from '@/api/programmes.api'
import { getStudyIndex } from '@/api/study-index'
import { registrationStatus } from '@/lib/registration'
import { mediaImage, type MediaImage } from '@/lib/media-image'
import type { Article, Media, Press } from '@/payload-types'

type Locale = 'en' | 'ar'

export const getHomeHeroDescription = async (payload: Payload, locale: Locale) => {
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    depth: 0,
    locale,
    fallbackLocale: false,
    select: { hero: true },
  })
  return settings.hero?.description?.trim() || null
}

const obj = <T>(v: unknown): T | null => (typeof v === 'object' && v !== null ? (v as T) : null)

/** Something people can register for today: a programme or a course. */
export type OpenItem = {
  kind: 'programme' | 'course'
  title: string
  href: string
  /** What it is and when: "Thematic Course · Fall 2026, Cairo". */
  sublabel?: string
  /** What it is: its course type; unset for a programme. */
  type?: string
  /** When and where: "Fall 2026, Cairo". */
  when?: string
  /** Who teaches it. */
  fellows?: string[]
  image?: MediaImage
  /** The last day to register (YYYY-MM-DD), when there is one. */
  deadline?: string
}

/**
 * Everything open for registration now, programmes first, then courses by
 * the nearest deadline. Courses come from the study index, which follows
 * deadlines every few minutes: public ones, and community ones for a
 * signed-in `reader`. Owner-only courses never show.
 */
export const getOpenNow = async (
  payload: Payload,
  locale: Locale,
  reader: unknown = null,
): Promise<OpenItem[]> => {
  const [index, { docs: programmes }, years] = await Promise.all([
    getStudyIndex(locale, siteTiers(reader)),
    payload.find({
      collection: 'programmes',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { 'registration.method': { in: ['form', 'external'] } },
        ],
      },
      sort: '-slug',
      limit: 20,
      depth: 1,
      locale,
      fallbackLocale: 'en',
      select: {
        title: true,
        slug: true,
        kind: true,
        tagline: true,
        cover: true,
        registration: true,
      },
    }),
    listBridgeYears(payload, locale),
  ])

  const programmeItems = programmes.flatMap((p): OpenItem[] => {
    if (registrationStatus(p.registration) !== 'open') return []
    // A Bridge year has its own page (the latest at /study/bridge); other programmes apply where registration points.
    const href =
      p.kind === 'bridge' && p.slug
        ? years[0]?.slug === p.slug
          ? '/study/bridge'
          : bridgeYearPath(p.slug)
        : (p.registration?.url ?? null)
    if (!href) return []
    const cover = obj<Media>(p.cover)
    return [
      {
        kind: 'programme',
        title: p.title,
        href,
        // Without its own cover the poster shows the CILAS mark.
        image: mediaImage(cover),
        deadline: p.registration?.deadline?.slice(0, 10),
      },
    ]
  })

  const courseItems = index
    .filter((c) => c.facets.registration?.[0]?.value === 'open')
    .map((c): OpenItem => ({
      kind: 'course',
      title: c.title,
      // The index keeps the language in its paths; links here add it themselves.
      href: c.href.replace(/^\/(en|ar)(?=\/)/, ''),
      sublabel: c.sublabel,
      type: c.facets.type?.[0]?.label,
      when: [
        [c.facets.season?.[0]?.label, c.facets.year?.[0]?.label].filter(Boolean).join(' '),
        c.facets.place?.[0]?.label,
      ]
        .filter(Boolean)
        .join(locale === 'ar' ? '، ' : ', '),
      fellows: (c.facets.fellow ?? []).map((f) => f.label),
      image: c.image ? { src: c.image, alt: c.imageAlt ?? '', ...c.imageFocalPoint } : undefined,
      deadline: c.deadline,
    }))
    // The nearest deadline first; those without one last.
    .sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))

  return [...programmeItems, ...courseItems]
}

/**
 * The featured articles, and the latest six of the rest; the featured ones
 * show as a grid, the rest to drag through. Until any article is featured,
 * the latest ones stand in, so the section is never empty.
 */
export const getHomeArticles = async (
  payload: Payload,
  locale: Locale,
): Promise<{ featured: Article[]; latest: Article[] }> => {
  const query = (where: Where, limit: number) =>
    payload.find({
      collection: 'articles',
      where: { and: [{ _status: { equals: 'published' } }, where] },
      sort: ['-published_date', '-createdAt'],
      depth: 2,
      limit,
      locale,
      fallbackLocale: locale === 'ar' ? 'en' : 'ar',
      overrideAccess: false,
    })
  const [featured, latest] = await Promise.all([
    query({ featured: { equals: true } }, 0),
    query({ featured: { not_equals: true } }, 6),
  ])
  return { featured: featured.docs, latest: latest.docs }
}

export type HomeStats = { years: number; courses: number; fellows: number }

/** The institute in three numbers, all counted from the archive. */
export const getHomeStats = async (payload: Payload): Promise<HomeStats> => {
  const [courses, fellows] = await Promise.all([
    payload.count({
      collection: 'courses',
      where: { and: [{ _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
    }),
    payload.find({
      collection: 'courses',
      where: { _status: { equals: 'published' } },
      limit: 0,
      depth: 0,
      select: { fellows: true },
    }),
  ])
  const distinct = (ids: unknown[]) =>
    new Set(ids.map((v) => (typeof v === 'object' && v ? (v as { id: number }).id : v))).size
  return {
    // CILAS opened in 2013.
    years: new Date().getFullYear() - 2013,
    courses: courses.totalDocs,
    fellows: distinct(fellows.docs.flatMap((c) => c.fellows ?? [])),
  }
}

export type PressOutlet = { name: string; href?: string; logo?: string }

/**
 * The outlets that have written about CILAS, most recent first, each linking
 * to its latest piece, with its logo when it has one.
 */
export const getPressOutlets = async (payload: Payload, locale: Locale): Promise<PressOutlet[]> => {
  const { docs } = await payload.find({
    collection: 'press',
    sort: '-published_date',
    limit: 0,
    depth: 1, // the outlet's logo
    locale,
    fallbackLocale: 'en',
  })
  const outlets = new Map<string, PressOutlet>()
  for (const piece of docs as Press[]) {
    const outlet = piece.outlet
    if (!outlet?.name || outlets.has(outlet.name)) continue
    const link = piece.links?.find((l) => l.url) ?? null
    const logo = obj<Media>(outlet.logo)
    outlets.set(outlet.name, {
      name: outlet.name,
      ...(link?.url ? { href: link.url } : {}),
      ...(logo?.url ? { logo: logo.url } : {}),
    })
  }
  return [...outlets.values()]
}
