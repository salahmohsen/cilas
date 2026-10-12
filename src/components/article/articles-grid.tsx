'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import type { ArticleCard } from '@/lib/article-cards'

/**
 * Arc's blog-grid with CILAS articles: publications are the categories, and
 * every card opens the article's own page. The chosen publication is kept in
 * the URL (`?publication=<slug>`) so a filtered list can be shared.
 */
export function ArticlesGrid({
  title,
  description,
  posts,
  categories,
  initialCategory,
  slugs,
  showFeatured = true,
  pageSize = 9,
  categoryOrder,
}: {
  title: string
  description: string
  posts: ArticleCard[]
  categories: string[]
  initialCategory?: string
  /** Category title → URL value. */
  slugs?: Record<string, string>
  showFeatured?: boolean
  pageSize?: number
  /** Card ids in reading order, per category title (a publication's own order). */
  categoryOrder?: Record<string, string[]>
}) {
  const t = useTranslations('Articles.grid')
  const router = useRouter()
  return (
    <BlogGrid
      categories={categories}
      categoryOrder={categoryOrder}
      defaultCategory={initialCategory ?? 'All'}
      description={description}
      getHref={(post) => posts.find((p) => p.id === post.id)?.href ?? '#'}
      labels={{
        all: t('all'),
        allPosts: t('allPosts'),
        filterBy: t('filterBy'),
        pagination: t('pagination'),
        previous: t('previous'),
        next: t('next'),
        previousPage: t('previousPage'),
        nextPage: t('nextPage'),
        page: (n) => t('page', { n }),
        empty: (category) => t('empty', { category }),
      }}
      onCategoryChange={(category) => {
        if (!slugs) return
        const slug = category === 'All' ? null : slugs[category]
        const url = new URL(window.location.href)
        if (slug) url.searchParams.set('publication', slug)
        else url.searchParams.delete('publication')
        router.replace(`${url.pathname}${url.search}`, { scroll: false })
      }}
      pageSize={pageSize}
      posts={posts}
      showFeatured={showFeatured}
      title={title}
    />
  )
}
