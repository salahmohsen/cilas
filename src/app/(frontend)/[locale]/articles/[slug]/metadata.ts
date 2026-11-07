import { getArticleForReading, type Reader } from '@/api/articles.api'
import type { Locale } from '@/i18n/routing'
import { excerptOf } from '@/lib/articles'
import { detailPath } from '@/lib/paths'
import { isRelation as isObject } from '@/lib/relation'
import { buildPageMetadata } from '@/lib/seo'
import type { Media } from '@/payload-types'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
type View = { locale: string; slug: string; user: Reader }
/** The page metadata. Shared by the cached page and the signed-in one. */
export async function articleMetadata({ locale, slug, user }: View): Promise<Metadata> {
  const payload = await getPayload({ config })
  const reading = await getArticleForReading(payload, slug, { locale: locale as Locale, user })
  if (!reading) return {}
  const { article, title, body } = reading
  const metaTitle = article.meta?.title || `${title} — CILAS`
  // The SEO image, else the article's cover; the site's default otherwise.
  const media = (v: unknown) => (isObject<Media>(v) && v.url ? v.url : null)
  const image = media(article.meta?.image) ?? media(article.cover_image)
  const description = article.meta?.description || excerptOf({ body }, 160)
  return buildPageMetadata({
    title: metaTitle,
    description,
    image,
    path: detailPath('articles', String(article.slug)),
    locale,
    type: 'article',
  })
}
