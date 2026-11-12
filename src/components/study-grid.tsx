'use client'

import { useMemo } from 'react'

import type { StudyRow } from '@/api/study-index'
import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { TYPE_ICONS } from '@/components/course-rows'

/**
 * One page of the study list as Arc's blog grid cards. The page's own filters
 * and pages do the rest, so the grid shows the rows as given: no featured card,
 * no category tabs, one page, and every card a link (which also turns the
 * grid's reader off). A course without a cover shows its type's icon.
 */
export function StudyGrid({ label, rows }: { label: string; rows: StudyRow[] }) {
  const byId = useMemo(() => new Map(rows.map((row) => [String(row.id), row])), [rows])
  const posts = useMemo<BlogPost[]>(
    () =>
      rows.map((row) => ({
        id: String(row.id),
        title: row.title,
        excerpt: row.description ?? '',
        category: row.type.label,
        // The card's kicker line: its type, and its cycle when it has one.
        label:
          row.season && row.year
            ? `${row.type.label} · ${row.season.label} ${row.year}`
            : row.type.label,
        date: '',
        dateLabel: '',
        readTime: 0,
        readTimeLabel: '',
        author: { name: '' },
        ...(row.image
          ? {
              image: {
                src: row.image,
                alt: row.imageAlt ?? '',
                focalX: row.imageFocalPoint?.focalX,
                focalY: row.imageFocalPoint?.focalY,
              },
            }
          : {}),
      })),
    [rows],
  )
  return (
    <BlogGrid
      categories={[]}
      flush
      getHref={(post) => byId.get(post.id)?.href ?? '#'}
      header={false}
      imageFallback={(post) => {
        const row = byId.get(post.id)
        const Icon = row ? TYPE_ICONS[row.type.value] : undefined
        return Icon ? <Icon aria-hidden size={28} strokeWidth={1.5} /> : null
      }}
      order="given"
      pageSize={Math.max(1, rows.length)}
      posts={posts}
      showFeatured={false}
      title={label}
    />
  )
}
