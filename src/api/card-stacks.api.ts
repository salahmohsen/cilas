import { type Locale, otherLocale } from '@/i18n/routing'
import { relId } from '@/lib/relation'
import { walkEditorNodes } from '@/lib/rich-text-references'
import type { Payload, Where } from 'payload'

import type { Reader } from '@/api/articles.api'
import type { BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid-data'
import type { OrbitStackItem } from '@/components/ui/orbit-card-stack'
import { COURSE_TYPE_OPTIONS, type CourseType } from '@/fields/course-type'
import type { ArticleCard } from '@/lib/article-cards'
import type { Season } from '@/lib/cycle'
import { mediaImage } from '@/lib/media-image'
import { pathOf } from '@/lib/paths'
import type { Article, Course, Cycle, Media, Person, Publication } from '@/payload-types'

/** A grid card: a blog-grid post with the page it opens. */
export type GridPost = BlogPost & { href: string }

/** One Card stack block of an article's text, ready to draw. */
export type ResolvedStack = {
  label: string
  layout: 'stack' | 'grid'
  items: OrbitStackItem[]
  /** The grid's cards; empty for a stack. */
  posts: GridPost[]
  /** Course type names for the grid's tabs; empty when fewer than two types. */
  categories: string[]
  /** Course slug → its cycle's season, for a grid card without a cover. */
  seasons: Record<string, Season>
}

type StackFields = {
  id?: string
  blockType?: string
  layout?: 'stack' | 'grid' | null
  source?: 'publication' | 'articles' | 'courses' | 'cycle'
  publication?: number | Publication | null
  articles?: Array<number | Article> | null
  courses?: Array<number | Course> | null
  cycle?: number | Cycle | null
  label?: string | null
}

const idOf = (v: unknown): number | null =>
  typeof v === 'number' || (v !== null && typeof v === 'object' && 'id' in v)
    ? (relId(v) as number)
    : null

/** Every Card stack block in a Lexical body, at any depth. */
const stacksIn = (node: unknown, found: StackFields[] = []): StackFields[] => {
  walkEditorNodes(
    node,
    (n) => {
      if (n.type === 'block' && n.fields?.blockType === 'cardStack')
        found.push(n.fields as StackFields)
    },
    false,
  )
  return found
}

const coverOf = (m: unknown) => {
  const image = mediaImage(m && typeof m === 'object' ? (m as Media) : null)
  return image
    ? {
        image: image.src,
        imageAlt: image.alt,
        imageFocalPoint: { focalX: image.focalX, focalY: image.focalY },
      }
    : {}
}

const names = (people: unknown) =>
  ((people as Array<Person | number> | null | undefined) ?? [])
    .flatMap((p) => (typeof p === 'object' && p?.name ? [p.name] : []))
    .join(', ')

const courseItem = (c: Course): OrbitStackItem => {
  const cycle = typeof c.cycle === 'object' && c.cycle ? c.cycle.title : null
  return {
    name: c.title,
    role: names(c.fellows),
    description: c.summary || c.subtitle || '',
    href: pathOf('courses', c) ?? '#',
    ...coverOf(c.cover_image),
    ...(cycle ? { stat: cycle } : {}),
  }
}

/** A course as a grid card: its type is its tab and its label. */
const coursePost = (
  c: Course,
  locale: Locale,
  typeName: (type: CourseType) => string,
): GridPost => {
  const type = typeName(c.course_type)
  const image = mediaImage(typeof c.cover_image === 'object' ? c.cover_image : null)
  return {
    id: c.slug ?? String(c.id),
    href: pathOf('courses', c, locale) ?? '#',
    title: c.title,
    excerpt: c.summary || c.subtitle || '',
    category: type,
    label: type,
    date: '',
    dateLabel: '',
    readTime: 0,
    readTimeLabel: '',
    author: { name: names(c.fellows) },
    ...(image ? { image } : {}),
  }
}

/** One tab per course type present, in the types' own order; none for a single type. */
const typeTabs = (courses: Course[], typeName: (type: CourseType) => string): string[] => {
  const present = COURSE_TYPE_OPTIONS.map((o) => o.value).filter((v) =>
    courses.some((c) => c.course_type === v),
  )
  return present.length > 1 ? present.map(typeName) : []
}

/** Each course's cycle season, by slug. */
const seasonsOf = (courses: Course[]): Record<string, Season> =>
  Object.fromEntries(
    courses.flatMap((c) =>
      typeof c.cycle === 'object' && c.cycle?.season && c.slug ? [[c.slug, c.cycle.season]] : [],
    ),
  )

/**
 * The Card stack blocks of an article's body, each with its cards, read as
 * this reader may: only published items they can open. Keyed by block id.
 * `articleItem` draws an article card as the page draws its others, and
 * `articleCard` the same article as a grid card; the open article is left
 * out of its own stack.
 */
export const resolveCardStacks = async (
  payload: Payload,
  body: unknown,
  {
    locale,
    user,
    current,
    articleItem,
    articleCard,
    labels,
  }: {
    locale: Locale
    user: Reader
    current: number
    articleItem: (a: Article, index: number, total: number) => OrbitStackItem
    articleCard: (a: Article) => ArticleCard
    labels: {
      collection: (title: string) => string
      articles: string
      courses: string
      courseType: (type: CourseType) => string
    }
  },
): Promise<Record<string, ResolvedStack>> => {
  const read = {
    locale,
    fallbackLocale: otherLocale(locale) as Locale,
    overrideAccess: false,
    user,
  }
  const findArticles = async (ids: number[]) => {
    if (!ids.length) return []
    const { docs } = await payload.find({
      collection: 'articles',
      where: { and: [{ id: { in: ids } }, { _status: { equals: 'published' } }] },
      depth: 2,
      pagination: false,
      ...read,
    })
    return ids.flatMap((id) => docs.filter((d) => d.id === id && d.id !== current))
  }
  const findCourses = async (where: Where, ids?: number[]) => {
    const { docs } = await payload.find({
      collection: 'courses',
      where: { and: [where, { _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
      depth: 1,
      pagination: false,
      sort: 'title',
      ...read,
    })
    return ids ? ids.flatMap((id) => docs.filter((d) => d.id === id)) : docs
  }

  const out: Record<string, ResolvedStack> = {}
  for (const block of stacksIn(body)) {
    if (!block.id) continue
    let articles: Article[] = []
    let courses: Course[] = []
    let label = block.label?.trim() || ''
    if (block.source === 'publication') {
      const pubId = idOf(block.publication)
      const pub = pubId
        ? await payload
            .findByID({ collection: 'publications', id: pubId, depth: 0, ...read })
            .catch(() => null)
        : null
      if (pub) {
        articles = await findArticles(
          (pub.articles ?? []).map(idOf).filter((id): id is number => id !== null),
        )
        label ||= labels.collection(pub.title)
      }
    } else if (block.source === 'articles') {
      articles = await findArticles(
        (block.articles ?? []).map(idOf).filter((id): id is number => id !== null),
      )
      label ||= labels.articles
    } else if (block.source === 'courses') {
      const ids = (block.courses ?? []).map(idOf).filter((id): id is number => id !== null)
      courses = ids.length ? await findCourses({ id: { in: ids } }, ids) : []
      label ||= labels.courses
    } else if (block.source === 'cycle') {
      const cycleId = idOf(block.cycle)
      courses = cycleId ? await findCourses({ cycle: { equals: cycleId } }) : []
      label ||=
        typeof block.cycle === 'object' && block.cycle?.title ? block.cycle.title : labels.courses
    }
    const items = [
      ...articles.map((a, i) => articleItem(a, i, articles.length)),
      ...courses.map(courseItem),
    ]
    if (!items.length) continue
    const grid = block.layout === 'grid'
    out[block.id] = {
      label,
      layout: grid ? 'grid' : 'stack',
      items,
      posts: grid
        ? [
            ...articles.map((a) => articleCard(a)),
            ...courses.map((c) => coursePost(c, locale, labels.courseType)),
          ]
        : [],
      categories: grid ? typeTabs(courses, labels.courseType) : [],
      seasons: grid ? seasonsOf(courses) : {},
    }
  }
  return out
}
