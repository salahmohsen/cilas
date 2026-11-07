'use client'
import { useBlogGridLabels } from '@/components/blog-grid-labels'

import { detailPath } from '@/lib/paths'

import { useLocale, useTranslations } from 'next-intl'

import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { SEASON_ICONS } from '@/components/season-icon'
import type { Season } from '@/lib/cycle'

export function BridgeCourses({
  title,
  posts,
  semesters,
  seasons,
}: {
  title: string
  posts: BlogPost[]
  semesters: string[]
  seasons: Record<string, Season>
}) {
  const t = useTranslations('Bridge')
  const labels = useBlogGridLabels()
  const locale = useLocale()
  return (
    <BlogGrid
      categories={semesters}
      flush
      getHref={(post) => detailPath('courses', String(post.id), locale)}
      header={false}
      imageFallback={(post) => {
        const Icon = SEASON_ICONS[seasons[post.id]!]
        return Icon ? <Icon aria-hidden size={28} strokeWidth={1.5} /> : null
      }}
      labels={{
        ...labels,
        all: t('wholeYear'),
        allPosts: undefined,
        filterBy: t('filterBy'),
        empty: () => t('noCourses'),
      }}
      order="given"
      pageSize={6}
      posts={posts}
      showFeatured={false}
      title={title}
    />
  )
}
