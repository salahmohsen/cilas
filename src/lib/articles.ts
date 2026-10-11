import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

import type { Article, Person, Publication } from '@/payload-types'

const isObject = <T>(v: number | T | null | undefined): v is T => typeof v === 'object' && v !== null

export const authorNames = (article: Pick<Article, 'authors'>): string[] =>
  (article.authors ?? []).filter(isObject<Person>).map((p) => p.name)

/** "A", "A and B", "A, B and C". */
export const joinNames = (names: string[], and = 'and'): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`

export const creditNames = (article: Pick<Article, 'credits'>, role: string): string[] =>
  (article.credits ?? [])
    .filter((c) => c.role === role)
    .flatMap((c) => c.people.filter(isObject<Person>).map((p) => p.name))

/** The first publication the article belongs to (the join lists them). */
export const publicationOf = (article: Pick<Article, 'publications'>): Publication | undefined =>
  (article.publications?.docs ?? []).find(isObject<Publication>)

/** The opening of the body as plain text, cut at a word boundary. */
export const excerptOf = (article: Pick<Article, 'body'>, max = 220): string => {
  if (!article.body) return ''
  const firstParagraph = article.body.root.children.find((n) => n.type === 'paragraph')
  const text = convertLexicalToPlaintext({
    data: { root: { ...article.body.root, children: firstParagraph ? [firstParagraph] : [] } },
  })
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, text.lastIndexOf(' ', max))}…`
}

/** Minutes to read at about 220 words a minute. */
export const readingMinutes = (article: Pick<Article, 'body'>): number => {
  if (!article.body) return 0
  const words = convertLexicalToPlaintext({ data: article.body }).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
}

export const yearOf = (article: Pick<Article, 'published_date' | 'createdAt'>): string =>
  new Date(article.published_date ?? article.createdAt).getFullYear().toString()

/** Two-digit index for numbered lists: 1 → "01". */
export const indexLabel = (i: number): string => String(i + 1).padStart(2, '0')
