import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getPublishedArticles, type Locale } from '@/api/articles.api'
import { ArticlesGrid } from '@/components/article/articles-grid'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { toArticleCard } from '@/lib/article-cards'
import { publicationOf } from '@/lib/articles'

export const revalidate = 3600

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ publication?: string }>
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Articles')
  return { title: t('metaTitle'), description: t('metaDescription') }
}

/** The article index: Arc's blog-grid, one tab per publication. */
export default async function ArticlesPage({ params, searchParams }: Props) {
  const [{ locale }, { publication: selected }] = await Promise.all([params, searchParams])
  const [t, tArticle, format] = await Promise.all([
    getTranslations('Articles'),
    getTranslations('Article'),
    getFormatter(),
  ])
  const payload = await getPayload({ config })
  const { docs } = await getPublishedArticles(payload, locale as Locale)

  const other = t('notes')
  const posts = docs.map((a) =>
    toArticleCard(a, {
      locale,
      format,
      minutesLabel: (m) => tArticle('minutes', { count: m }),
      and: tArticle('and'),
      otherCategory: other,
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
      description={t('intro')}
      initialCategory={initial}
      posts={posts}
      slugs={slugs}
      title={t('title')}
    />
  )
}
