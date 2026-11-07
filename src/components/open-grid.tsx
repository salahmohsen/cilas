'use client'
import { useBlogGridLabels } from '@/lib/blog-grid-labels'

import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'

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
  const labels = useBlogGridLabels()
  return (
    <BlogGrid
      categories={categories}
      defaultCategory="All"
      flush
      getHref={(post) => posts.find((p) => p.id === post.id)?.href ?? '#'}
      header={false}
      labels={labels}
      order="given"
      pageSize={12}
      posts={posts}
      showFeatured
      title={title}
    />
  )
}
