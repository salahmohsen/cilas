'use client'
import type { BlogGridLabels } from '@/components/arc/blocks/blog-grid/blog-grid'
import { localDigits } from '@/lib/digits'
import { useLocale, useTranslations } from 'next-intl'
export function useBlogGridLabels(): BlogGridLabels {
  const locale = useLocale()
  const t = useTranslations('Articles.grid')
  return {
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
  }
}
