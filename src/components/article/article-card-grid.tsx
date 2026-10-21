'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { GridPost } from '@/api/card-stacks.api'
import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import { SEASON_ICONS } from '@/components/season-icon'
import type { Season } from '@/lib/cycle'
import { localDigits } from '@/lib/digits'

/**
 * A Card stack block set to grid, in an article's text: Arc's blog grid
 * with every card on one page, tabs by course type when there are two or
 * more, and a course without a cover showing its season's mark.
 */
export function ArticleCardGrid({
  posts,
  categories,
  seasons,
  label,
}: {
  posts: GridPost[]
  categories: string[]
  seasons: Record<string, Season>
  label: string
}) {
  const t = useTranslations('Articles.grid')
  const ta = useTranslations('Article')
  const locale = useLocale()
  return (
    <section aria-label={label} className="not-prose my-8">
      <BlogGrid
        categories={categories}
        defaultCategory="All"
        flush
        getHref={(post) => posts.find((p) => p.id === post.id)?.href ?? '#'}
        header={false}
        imageFallback={(post) => {
          const season = seasons[post.id]
          const Icon = season ? SEASON_ICONS[season] : undefined
          return Icon ? <Icon aria-hidden size={28} strokeWidth={1.5} /> : null
        }}
        labels={{
          all: t('all'),
          allPosts: t('allPosts'),
          filterBy: ta('gridFilterBy'),
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
        pageSize={Math.max(1, posts.length)}
        posts={posts}
        showFeatured={false}
        title={label}
      />
    </section>
  )
}
