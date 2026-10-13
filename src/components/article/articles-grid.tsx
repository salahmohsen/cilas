'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import type { ArticleCard } from '@/lib/article-cards'
import { localDigits } from '@/lib/digits'

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
  header = true,
  flush = false,
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
  /** Off when the page gives the grid its own heading; `title` still names it. */
  header?: boolean
  /** Sits inside the page's column, without the grid's own width and padding. */
  flush?: boolean
}) {
  const t = useTranslations('Articles.grid')
  const locale = useLocale()
  const router = useRouter()
  return (
    <BlogGrid
      flush={flush}
      header={header}
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
        number: (n) => localDigits(n, locale),
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
