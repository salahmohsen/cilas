'use client'
import { useBlogGridLabels } from '@/components/blog-grid-labels'

import { useTranslations } from 'next-intl'

import type { GridPost } from '@/api/card-stacks.api'
import { BlogGrid } from '@/components/arc/blocks/blog-grid/blog-grid'
import { SEASON_ICONS } from '@/components/season-icon'
import type { Season } from '@/lib/cycle'

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
  const labels = useBlogGridLabels()
  const ta = useTranslations('Article')
  return (
    <div className="not-prose my-8">
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
        labels={{ ...labels, filterBy: ta('gridFilterBy') }}
        order="given"
        pageSize={Math.max(1, posts.length)}
        posts={posts}
        showFeatured={false}
        title={label}
      />
    </div>
  )
}
