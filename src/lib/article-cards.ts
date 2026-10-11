import type { getFormatter } from 'next-intl/server'

import { authorNames, excerptOf, joinNames, publicationOf, readingMinutes } from '@/lib/articles'
import { pathOf } from '@/lib/paths'
import type { Article, Media, Person } from '@/payload-types'

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
  author: { name: string }
  image?: { src: string; alt: string }
  featured?: boolean
}

/**
 * An article as an Arc blog-grid card, in the site language. Its category
 * is its publication, or `otherCategory` when it belongs to none.
 */
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
  const media = (v: unknown): Media | undefined =>
    typeof v === 'object' && v !== null && (v as Media).url ? (v as Media) : undefined
  const writer = (a.authors ?? []).find((p): p is Person => typeof p === 'object' && p !== null)
  const pub = publicationOf(a)
  const image =
    media(a.cover_image) ?? media(writer?.photo) ?? media(pub?.cover_image) ?? (pub ? publicationCovers?.get(pub.id) : undefined)
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
    author: { name: joinNames(authorNames(a), and) },
    ...(image?.url ? { image: { src: image.url, alt: image.alt } } : {}),
    ...(a.featured ? { featured: true } : {}),
  }
}
