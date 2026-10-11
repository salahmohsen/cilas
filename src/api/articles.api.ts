import type { Payload } from 'payload'

import type { Article } from '@/payload-types'

export type Locale = 'en' | 'ar'

/**
 * Published articles a visitor may read, newest first. Access rules apply
 * (`overrideAccess: false`), so tiers are honoured and drafts — imported
 * articles awaiting review among them — stay off the list.
 */
export const getPublishedArticles = async (payload: Payload, locale: Locale = 'en') =>
  payload.find({
    collection: 'articles',
    where: { _status: { equals: 'published' } },
    sort: ['-published_date', '-createdAt'],
    depth: 2,
    limit: 200,
    locale,
    fallbackLocale: 'en',
    overrideAccess: false,
  })

/**
 * One article by slug. In preview (draft mode) the latest draft is read with
 * access bypassed, as the course page does; otherwise only what a visitor may
 * see.
 */
export const getArticle = async (
  payload: Payload,
  slug: string,
  { locale = 'en', preview = false }: { locale?: Locale; preview?: boolean } = {},
): Promise<Article | undefined> => {
  const { docs } = await payload.find({
    collection: 'articles',
    where: preview
      ? { slug: { equals: slug } }
      : { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
    limit: 1,
    depth: 2,
    locale,
    fallbackLocale: false,
    draft: preview,
    overrideAccess: preview,
  })
  return docs[0]
}

/** Whether the article has a body in the given locale, without loading it all. */
export const hasLocaleBody = async (payload: Payload, id: number, locale: Locale): Promise<boolean> => {
  const doc = await payload.findByID({
    collection: 'articles',
    id,
    locale,
    fallbackLocale: false,
    depth: 0,
    select: { body: true },
    overrideAccess: true,
    draft: true,
  })
  return Boolean(doc?.body?.root?.children?.length)
}
