import type { getFormatter } from 'next-intl/server'

import { authorNames, excerptOf, joinNames, publicationOf, readingMinutes } from '@/lib/articles'
import { pathOf } from '@/lib/paths'
import { mediaImage, type MediaImage } from '@/lib/media-image'
import type { Article, Course, Media, Person } from '@/payload-types'

export type ArticleCard = {
  id: string
  href: string
  title: string
  excerpt: string
  category: string
  date: string
  dateLabel: string
  readTime: number
  readTimeLabel: string
  author: { name: string; avatar?: string }
  image?: MediaImage
  featured?: boolean
}

/**
 * An article as an Arc blog-grid card, in the site language. Its category
 * is its publication, or `otherCategory` when it belongs to none.
 */
const media = (v: unknown): Media | undefined =>
  typeof v === 'object' && v !== null && (v as Media).url ? (v as Media) : undefined

/** A person's photo at byline size, when they have one. */
const avatarOf = (p: Person | undefined): string | undefined => {
  const photo = media(p?.photo)
  return photo ? (photo.sizes?.thumbnail?.url ?? photo.url ?? undefined) : undefined
}

const byline = (people: Person[], and: string) => {
  const avatar = avatarOf(people.find((p) => avatarOf(p)))
  return {
    name: joinNames(
      people.map((p) => p.name),
      and,
    ),
    ...(avatar ? { avatar } : {}),
  }
}

export const toArticleCard = (
  a: Article,
  {
    locale,
    format,
    minutesLabel,
    and,
    otherCategory,
    publicationCovers,
  }: {
    locale: string
    format: Awaited<ReturnType<typeof getFormatter>>
    minutesLabel: (m: number) => string
    and: string
    otherCategory: string
    publicationCovers?: Map<number, Media>
  },
): ArticleCard => {
  // The article's own image, else its writer's photo, else its publication's cover.
  const writer = (a.authors ?? []).find((p): p is Person => typeof p === 'object' && p !== null)
  const pub = publicationOf(a)
  const image =
    media(a.cover_image) ??
    media(writer?.photo) ??
    media(pub?.cover_image) ??
    (pub ? publicationCovers?.get(pub.id) : undefined)
  const date = a.published_date ?? a.createdAt
  const minutes = readingMinutes(a)
  return {
    id: String(a.id),
    href: pathOf('articles', a, locale) ?? '#',
    title: a.title,
    excerpt: excerptOf(a, 160),
    category: publicationOf(a)?.title ?? otherCategory,
    date: date.slice(0, 10),
    dateLabel: format.dateTime(new Date(date), 'year'),
    readTime: minutes,
    readTimeLabel: minutesLabel(minutes),
    author: { ...byline(writer ? [writer] : [], and), name: joinNames(authorNames(a), and) },
    ...(image?.url ? { image: mediaImage(image) } : {}),
    ...(a.featured ? { featured: true } : {}),
  }
}

/**
 * A course as a blog-grid card: its cycle in place of a publication, its
 * length in place of a reading time, and its fellows on the byline.
 */
export const toCourseCard = (
  c: Course,
  {
    locale,
    format,
    weeksLabel,
    and,
  }: {
    locale: string
    format: Awaited<ReturnType<typeof getFormatter>>
    weeksLabel: (w: number) => string
    and: string
  },
): ArticleCard => {
  const cycle = typeof c.cycle === 'object' && c.cycle ? c.cycle : null
  const fellows = (c.fellows ?? []).filter((p): p is Person => typeof p === 'object' && p !== null)
  const image = media(c.cover_image)
  const date = c.schedule?.start_date ?? cycle?.start_date ?? c.createdAt
  const weeks = c.schedule?.weeks ?? 0
  return {
    id: String(c.id),
    href: pathOf('courses', c, locale) ?? '#',
    title: c.title,
    excerpt: c.summary ?? c.subtitle ?? '',
    category: cycle?.title ?? '',
    date: date.slice(0, 10),
    dateLabel: format.dateTime(new Date(date), 'year'),
    readTime: weeks,
    readTimeLabel: weeks ? weeksLabel(weeks) : '',
    author: byline(fellows, and),
    ...(image?.url ? { image: mediaImage(image) } : {}),
  }
}
