import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import {
  getPublicationCovers,
  getPublishedArticles,
  type Locale,
  type Reader,
} from '@/api/articles.api'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { toArticleCard } from '@/lib/article-cards'
import { publicationOf } from '@/lib/articles'

/** The page metadata. Shared by the cached page and the signed-in one. */
export async function articlesMetadata(): Promise<Metadata> {
  const t = await getTranslations('Articles')
  return { title: t('metaTitle'), description: t('metaDescription') }
}

/**
 * The article index: Arc's blog-grid, one tab per publication. `user` is null
 * on the cached page; the signed-in page passes the account, which adds the
 * `community` articles.
 */
export async function ArticlesPage({
  locale,
  selected,
  user,
}: {
  locale: string
  selected?: string
  user: Reader
}) {
  const [t, tArticle, format] = await Promise.all([
    getTranslations('Articles'),
    getTranslations('Article'),
    getFormatter(),
  ])
  const payload = await getPayload({ config })
  const [{ docs }, publicationCovers] = await Promise.all([
    getPublishedArticles(payload, locale as Locale, user),
    getPublicationCovers(payload),
  ])

  const other = t('notes')
  const posts = docs.map((a) =>
    toArticleCard(a, {
      locale,
      format,
      minutesLabel: (m) => tArticle('minutes', { count: m }),
      and: tArticle('and'),
      otherCategory: other,
      publicationCovers,
    }),
  )
  // Publications in first-seen order (newest article first), then the rest.
  const slugs: Record<string, string> = {}
  for (const a of docs) {
    const p = publicationOf(a)
    if (p && !slugs[p.title]) slugs[p.title] = p.slug
  }
  if (docs.some((a) => !publicationOf(a))) slugs[other] = 'other'
  const categories = Object.keys(slugs)
  // A publication lists its articles in its own order (its print edition's
  // contents: the foreword, then the essays), not newest first.
  const categoryOrder: Record<string, string[]> = {}
  for (const a of docs) {
    const p = publicationOf(a)
    if (p && !categoryOrder[p.title])
      categoryOrder[p.title] = (p.articles ?? []).map((x) => String(typeof x === 'object' ? x.id : x))
  }
  const initial = Object.entries(slugs).find(([, slug]) => slug === selected)?.[0]

  if (posts.length === 0) {
    return (
      <div className="px-4 py-24 sm:px-6">
        <EmptyState description={t('emptyText')} title={t('empty')} />
      </div>
    )
  }

  return (
    <ArticlesGrid
      categories={categories.length > 1 ? categories : []}
      categoryOrder={categoryOrder}
      description={t('intro')}
      initialCategory={initial}
      posts={posts}
      slugs={slugs}
      title={t('title')}
    />
  )
}
