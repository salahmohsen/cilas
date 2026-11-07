import { plainText } from '@/lib/plaintext'
import { isRelation as isObject } from '@/lib/relation'

import type { Article, Person, Publication } from '@/payload-types'

export const authorNames = (article: Pick<Article, 'authors'>): string[] =>
  (article.authors ?? []).filter(isObject<Person>).map((p) => p.name)

export const joinNames = (names: string[], and = 'and'): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`

/** The first publication the article belongs to (the join lists them). */
export const publicationOf = (article: Pick<Article, 'publications'>): Publication | undefined =>
  (article.publications?.docs ?? []).find(isObject<Publication>)

/** The opening of the body as plain text, cut at a word boundary. */
export const excerptOf = (article: Pick<Article, 'body'>, max = 220): string => {
  if (!article.body) return ''
  const firstParagraph = article.body.root.children.find((n) => n.type === 'paragraph')
  const text = plainText({
    data: { root: { ...article.body.root, children: firstParagraph ? [firstParagraph] : [] } },
  })
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, text.lastIndexOf(' ', max))}…`
}

/**
 * Whether a description repeats the article's opening, so the reader would
 * read it twice: the page's lead is the description, and the body often
 * starts on the same words when the description was cut from the body.
 */
export const repeatsOpening = (description: string, body: Article['body']): boolean => {
  if (!body) return false
  const lead = description.replace(/\s+/g, ' ').trim()
  if (!lead) return false
  const text = plainText({ data: body }).replace(/\s+/g, ' ').trim()
  return text.startsWith(lead.endsWith('…') ? lead.slice(0, -1) : lead)
}

/** Minutes to read at about 220 words a minute. */
export const readingMinutes = (article: Pick<Article, 'body'>): number => {
  if (!article.body) return 0
  const words = plainText({ data: article.body }).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

export const yearOf = (article: Pick<Article, 'published_date' | 'createdAt'>): string =>
  new Date(article.published_date ?? article.createdAt).getFullYear().toString()

export const ARTICLE_PAGE_SIZE = 9

export const articleListSelection = (
  articles: Article[],
  query: { publication?: string; page?: string | number },
) => {
  const categoryOf = (article: Article) => publicationOf(article)?.slug ?? 'other'
  const publication = articles.some((article) => categoryOf(article) === query.publication)
    ? query.publication
    : undefined
  const count = publication
    ? articles.filter((article) => categoryOf(article) === publication).length
    : articles.length
  const pages = Math.max(1, Math.ceil((count > 1 ? count - 1 : count) / ARTICLE_PAGE_SIZE))
  const requested = Number(query.page)
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pages) : 1
  return { page, publication }
}

export const articleListPath = (page: number, publication?: string): string => {
  const query = new URLSearchParams()
  if (publication) query.set('publication', publication)
  if (Number.isSafeInteger(page) && page > 1) query.set('page', String(page))
  return `/articles${query.size ? `?${query}` : ''}`
}
