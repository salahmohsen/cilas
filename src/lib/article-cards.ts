import type { getFormatter } from 'next-intl/server'

import { authorNames, excerptOf, joinNames, publicationOf, readingMinutes } from '@/lib/articles'
import { pathOf } from '@/lib/paths'
import type { Article, Media } from '@/payload-types'

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
  }: {
    locale: string
    format: Awaited<ReturnType<typeof getFormatter>>
    minutesLabel: (m: number) => string
    and: string
    otherCategory: string
  },
): ArticleCard => {
  const image = typeof a.cover_image === 'object' && a.cover_image ? (a.cover_image as Media) : undefined
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
