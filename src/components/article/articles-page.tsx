import { pageAlternates } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'
import { cache } from 'react'

import {
  getPublicationCovers,
  getPublishedArticles,
  type Locale,
  type Reader,
} from '@/api/articles.api'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { toArticleCard } from '@/lib/article-cards'
import { articleListPath, articleListSelection, publicationOf } from '@/lib/articles'

const publishedFor = cache(async (locale: Locale, user: Reader) =>
  getPublishedArticles(await getPayload({ config }), locale, user),
)

/** The page metadata. Shared by the cached page and the signed-in one. */
export async function articlesMetadata(
  selected: { publication?: string; page?: string } = {},
  user: Reader = null,
): Promise<Metadata> {
  const locale = await getLocale()
  const t = await getTranslations('Articles')
  const { docs } = await publishedFor(locale as Locale, user)
  const selection = articleListSelection(docs, selected)
  return {
    alternates: pageAlternates(articleListPath(selection.page, selection.publication), locale),
    ...(selection.publication ? { robots: { index: false } } : {}),
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

/**
 * The article index: Arc's blog-grid, one tab per publication. `user` is null
 * on the cached page; the signed-in page passes the account, which adds the
 * `community` articles.
 */
export async function ArticlesPage({
  locale,
  selected,
  page = 1,
  user,
}: {
  locale: string
  selected?: string
  page?: number
  user: Reader
}) {
  const [t, tArticle, format] = await Promise.all([
    getTranslations('Articles'),
    getTranslations('Article'),
    getFormatter(),
  ])
  const payload = await getPayload({ config })
  const [{ docs }, publicationCovers] = await Promise.all([
    publishedFor(locale as Locale, user),
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
      categoryOrder[p.title] = (p.articles ?? []).map((x) =>
        String(typeof x === 'object' ? x.id : x),
      )
  }
  const selection = articleListSelection(docs, { publication: selected, page })
  const initial = Object.entries(slugs).find(([, slug]) => slug === selection.publication)?.[0]

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
      initialPage={selection.page}
      posts={posts}
      slugs={slugs}
      title={t('title')}
    />
  )
}
