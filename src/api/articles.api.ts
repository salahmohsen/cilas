import type { Payload, Where } from 'payload'

import type { Article } from '@/payload-types'

export type Locale = 'en' | 'ar'

const otherLocale = (locale: Locale): Locale => (locale === 'ar' ? 'en' : 'ar')

/**
 * Published articles a visitor may read, newest first. Access rules apply
 * (`overrideAccess: false`), so tiers are honoured and drafts — imported
 * articles awaiting review among them — stay off the list. A field missing in
 * the site language falls back to the other language (CONTEXT.md, content
 * language).
 */
export const getPublishedArticles = async (payload: Payload, locale: Locale = 'en') =>
  payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    sort: ['-published_date', '-createdAt'],
    depth: 2,
    limit: 200,
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
  })

const hasBody = (a?: Pick<Article, 'body'> | null): boolean => Boolean(a?.body?.root?.children?.length)

export type ArticleReading = {
  /** The article with its metadata in the site language. */
  article: Article
  /** The language the body below is written in. */
  contentLocale: Locale
  body: Article['body']
  title: string
  /** Whether the body also exists in the other language. */
  hasOther: boolean
}

/**
 * One article as a visitor reads it. The page stays in the site language;
 * when the article has no text in it, its body (and title) come from its
 * content language. In preview (draft mode) the latest draft is read with
 * access bypassed.
 */
export const getArticleForReading = async (
  payload: Payload,
  slug: string,
  { locale, preview = false }: { locale: Locale; preview?: boolean },
): Promise<ArticleReading | undefined> => {
  const read = (l: Locale) =>
    payload
      .find({
        collection: 'articles',
        where: preview
          ? { slug: { equals: slug } }
          : { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
        limit: 1,
        depth: 2,
        locale: l,
        fallbackLocale: false,
        draft: preview,
        overrideAccess: preview,
      })
      .then((r) => r.docs[0])

  const article = await read(locale)
  if (!article) return undefined
  const other = otherLocale(locale)
  const inOther = await read(other)

  if (hasBody(article)) {
    return { article, contentLocale: locale, body: article.body, title: article.title, hasOther: hasBody(inOther) }
  }
  if (inOther && hasBody(inOther)) {
    return {
      article,
      contentLocale: other,
      body: inOther.body,
      title: article.title || inOther.title,
      hasOther: false,
    }
  }
  return { article, contentLocale: locale, body: null, title: article.title || inOther?.title || '', hasOther: false }
}

/**
 * Related articles (CONTEXT.md): those an editor picked, then others from the
 * same publication, then ones sharing a tag, then others by the same author —
 * at most `limit`, and only ones this visitor may read.
 */
export const getRelatedArticles = async (
  payload: Payload,
  article: Article,
  locale: Locale,
  limit = 3,
): Promise<Article[]> => {
  const idOf = (v: number | { id: number }) => (typeof v === 'object' ? v.id : v)
  const picked: Article[] = []
  const seen = new Set<number>([article.id])

  const take = async (where: Where | null, order?: number[]) => {
    if (!where || picked.length >= limit) return
    const { docs } = await payload.find({
      collection: 'articles',
      where: { and: [where, { _status: { equals: 'published' } }, { id: { not_in: [...seen] } }] },
      depth: 1,
      limit: limit * 3,
      locale,
      fallbackLocale: otherLocale(locale),
      overrideAccess: false,
    })
    const ordered = order ? order.map((id) => docs.find((d) => d.id === id)).filter((d): d is Article => Boolean(d)) : docs
    for (const doc of ordered) {
      if (picked.length >= limit || seen.has(doc.id)) continue
      seen.add(doc.id)
      picked.push(doc)
    }
  }

  const editorIds = (article.related_articles ?? []).map(idOf)
  await take(editorIds.length ? { id: { in: editorIds } } : null, editorIds)

  const publication = (article.publications?.docs ?? []).find((p) => typeof p === 'object' && p !== null)
  const siblingIds =
    publication && typeof publication === 'object' ? (publication.articles ?? []).map(idOf) : []
  await take(siblingIds.length ? { id: { in: siblingIds } } : null, siblingIds)

  const tags = (article.tags ?? []).map((t) => t.tag).filter((t): t is string => Boolean(t))
  await take(tags.length ? { 'tags.tag': { in: tags } } : null)

  const authorIds = (article.authors ?? []).map(idOf)
  await take(authorIds.length ? { authors: { in: authorIds } } : null)

  return picked
}
