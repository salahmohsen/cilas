'use client'

import { useTranslations } from 'next-intl'

import { MorphSelect, type MorphSelectProps } from '@/components/arc/morph-select/morph-select'

/** The site's select: Arc's morph select speaking the page's language. */
export function Select(props: Omit<MorphSelectProps, 'text'>) {
  const t = useTranslations('Select')
  return (
    <MorphSelect
      {...props}
      text={{
        search: t('search'),
        clearSearch: t('clearSearch'),
        close: t('close'),
        noMatches: t('noMatches'),
        matches: (count) => t('matches', { count }),
      }}
    />
  )
}
