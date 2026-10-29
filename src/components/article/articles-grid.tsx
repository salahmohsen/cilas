'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import type { ArticleCard } from '@/lib/article-cards'
import { localDigits } from '@/lib/digits'
import { ARTICLE_PAGE_SIZE, articleListPath } from '@/lib/articles'

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
  initialPage = 1,
  slugs,
  showFeatured = true,
  pageSize = ARTICLE_PAGE_SIZE,
  categoryOrder,
  header = true,
  flush = false,
}: {
  title: string
  description: string
  posts: ArticleCard[]
  categories: string[]
  initialCategory?: string
  initialPage?: number
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
  const pageHref = (page: number, category: string) =>
    `/${locale}${articleListPath(page, category === 'All' ? undefined : slugs?.[category])}`
  return (
    <BlogGrid
      getPageHref={slugs ? pageHref : undefined}
      page={slugs ? initialPage : undefined}
      category={slugs ? (initialCategory ?? 'All') : undefined}
      onPageChange={
        slugs
          ? (page) => router.replace(pageHref(page, initialCategory ?? 'All'), { scroll: false })
          : undefined
      }
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
        router.replace(pageHref(1, category), { scroll: false })
      }}
      pageSize={pageSize}
      posts={posts}
      showFeatured={showFeatured}
      title={title}
    />
  )
}
