import type { Payload, Where } from 'payload'

import type { Article, Media, Publication, User } from '@/payload-types'

export type Locale = 'en' | 'ar'

/**
 * Who is reading. Null is an anonymous visitor: the cached pages read as one,
 * so `community` articles never reach them. The signed-in pages pass the
 * account, and access rules then add what it may read.
 */
export type Reader = User | null

const otherLocale = (locale: Locale): Locale => (locale === 'ar' ? 'en' : 'ar')

/**
 * Published articles a visitor may read, newest first. Access rules apply
 * (`overrideAccess: false`), so tiers are honoured and drafts — imported
 * articles awaiting review among them — stay off the list. A field missing in
 * the site language falls back to the other language (CONTEXT.md, content
 * language).
 */
export const getPublishedArticles = async (
  payload: Payload,
  locale: Locale = 'en',
  user: Reader = null,
) =>
  payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    sort: ['-published_date', '-createdAt'],
    depth: 2,
    limit: 200,
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
    user,
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
  /** The same article read in the other language (names missing here are there). */
  other?: Article
}

/**
 * One article as a visitor reads it. The page stays in the site language;
 * when the article has no text in it, its body (and title) come from its
 * content language. In preview (draft mode) the latest draft is read with
 * access bypassed; otherwise access rules apply, so a `community` article
 * opens only for a signed-in reader.
 */
export const getArticleForReading = async (
  payload: Payload,
  slug: string,
  { locale, preview = false, user = null }: { locale: Locale; preview?: boolean; user?: Reader },
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
        // The Local API skips access rules unless told otherwise.
        overrideAccess: preview,
        user,
      })
      .then((r) => r.docs[0])

  const article = await read(locale)
  if (!article) return undefined
  const other = otherLocale(locale)
  const inOther = await read(other)

  if (hasBody(article)) {
    return { article, contentLocale: locale, body: article.body, title: article.title, hasOther: hasBody(inOther), other: inOther }
  }
  if (inOther && hasBody(inOther)) {
    return {
      article,
      contentLocale: other,
      body: inOther.body,
      title: article.title || inOther.title,
      hasOther: false,
      other: inOther,
    }
  }
  return { article, contentLocale: locale, body: null, title: article.title || inOther?.title || '', hasOther: false, other: inOther }
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
  user: Reader = null,
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
      user,
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

export type ArticleCollection = {
  publication: Publication
  /** Every article of the publication, in its order. */
  articles: Article[]
}

/**
 * The publication an article belongs to, with all its articles in the order
 * the publication gives them (its print edition's contents), or undefined
 * when the article belongs to none. Only articles this visitor may read.
 */
export const getArticleCollection = async (
  payload: Payload,
  article: Article,
  locale: Locale,
  user: Reader = null,
): Promise<ArticleCollection | undefined> => {
  const idOf = (v: number | { id: number }) => (typeof v === 'object' ? v.id : v)
  const publication = (article.publications?.docs ?? []).find(
    (p): p is Publication => typeof p === 'object' && p !== null,
  )
  if (!publication) return undefined
  const order = (publication.articles ?? []).map(idOf)
  if (order.length < 2) return undefined
  const { docs } = await payload.find({
    collection: 'articles',
    where: { and: [{ id: { in: order } }, { _status: { equals: 'published' } }] },
    // Two levels: a card's picture may be its writer's photo.
    depth: 2,
    pagination: false,
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
    user,
  })
  const articles = order.map((id) => docs.find((d) => d.id === id)).filter((d): d is Article => Boolean(d))
  return { publication, articles }
}

/**
 * Publication covers by publication id. An article card falls back to its
 * publication's cover; the join that links them is not populated deep enough
 * to carry the image, so the covers are looked up once per page.
 */
export const getPublicationCovers = async (payload: Payload): Promise<Map<number, Media>> => {
  const { docs } = await payload.find({ collection: 'publications', depth: 1, limit: 50, overrideAccess: false })
  const covers = new Map<number, Media>()
  for (const p of docs) if (typeof p.cover_image === 'object' && p.cover_image?.url) covers.set(p.id, p.cover_image)
  return covers
}
