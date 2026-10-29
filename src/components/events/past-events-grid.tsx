'use client'

import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BlogGrid, type BlogPost } from '@/components/arc/blocks/blog-grid/blog-grid'
import { localDigits } from '@/lib/digits'

export function PastEventsGrid({
  posts,
  cards,
  categories,
  types,
  initialType,
  initialPage,
}: {
  posts: BlogPost[]
  cards: Record<string, ReactNode>
  categories: string[]
  types: Record<string, string>
  initialType?: string
  initialPage: number
}) {
  const t = useTranslations('Articles.grid')
  const events = useTranslations('Events')
  const locale = useLocale()
  const router = useRouter()
  const updateUrl = (type: string | null, page: number) => {
    const url = new URL(window.location.href)
    if (type) url.searchParams.set('type', type)
    else url.searchParams.delete('type')
    if (page > 1) url.searchParams.set('page', String(page))
    else url.searchParams.delete('page')
    router.replace(`${url.pathname}${url.search}#past-events`, { scroll: false })
  }
  return (
    <BlogGrid
      getPageHref={(page, category) => {
        const type = Object.keys(types).find((key) => types[key] === category)
        const query = new URLSearchParams()
        if (type) query.set('type', type)
        if (page > 1) query.set('page', String(page))
        return `/${locale}/events${query.size ? `?${query}` : ''}#past-events`
      }}
      title={events('past')}
      header={false}
      flush
      posts={posts}
      cards={cards}
      categories={categories}
      category={initialType ? (types[initialType] ?? 'All') : 'All'}
      page={initialPage}
      order="given"
      showFeatured={false}
      pageSize={6}
      onCategoryChange={(category) =>
        updateUrl(Object.keys(types).find((key) => types[key] === category) ?? null, 1)
      }
      onPageChange={(page) => updateUrl(initialType ?? null, page)}
      labels={{
        all: t('all'),
        allPosts: events('past'),
        filterBy: events('filterBy'),
        pagination: t('pagination'),
        previous: t('previous'),
        next: t('next'),
        previousPage: t('previousPage'),
        nextPage: t('nextPage'),
        page: (n) => t('page', { n }),
        number: (n) => localDigits(n, locale),
        empty: (category) => t('empty', { category }),
      }}
    />
  )
}
