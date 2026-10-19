'use client'

import { useLocale, useTranslations } from 'next-intl'

import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { localDigits } from '@/lib/digits'

export type OpenPost = BlogPost & { href: string }

/**
 * The Open for registration page's list: Arc's blog grid, with room to
 * read, the Bridge as the featured card, and tabs for programmes and each
 * kind of course. The order is ours: programmes first, then the nearest
 * deadline.
 */
export function OpenGrid({
  posts,
  categories,
  title,
}: {
  posts: OpenPost[]
  categories: string[]
  title: string
}) {
  const t = useTranslations('Articles.grid')
  const locale = useLocale()
  return (
    <BlogGrid
      categories={categories}
      defaultCategory="All"
      flush
      getHref={(post) => posts.find((p) => p.id === post.id)?.href ?? '#'}
      header={false}
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
      order="given"
      pageSize={12}
      posts={posts}
      showFeatured
      title={title}
    />
  )
}
