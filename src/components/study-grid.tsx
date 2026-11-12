'use client'

import Image from 'next/image'
import { useMemo } from 'react'

import type { StudyRow } from '@/api/study-index'
import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { TYPE_ICONS } from '@/components/course-rows'
import { focalPointStyle } from '@/lib/media-image'

/** A column is a third of the page on a desktop, half on a tablet, all of it on a phone. */
const IMAGE_SIZES =
  '(min-width: 90rem) 27rem, (min-width: 64rem) calc((100vw - 8rem) / 3), (min-width: 40rem) calc((100vw - 5rem) / 2), calc(100vw - 2rem)'

/**
 * One page of the study list as Arc's blog grid cards. The page's own filters
 * and pages do the rest, so the grid shows the rows as given: no featured card,
 * no category tabs, one page, and every card a link (which also turns the
 * grid's reader off). The cover goes in the card's fallback frame so it is a
 * `next/image`, sized per breakpoint, in the same 3:2 frame as the grid's own.
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
        if (row?.image)
          return (
            <Image
              alt={row.imageAlt ?? ''}
              className="study-grid-cover"
              fill
              sizes={IMAGE_SIZES}
              src={row.image}
              style={focalPointStyle(row.imageFocalPoint)}
            />
          )
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
