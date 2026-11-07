'use client'

import { useTranslations } from 'next-intl'

import { MorphSelect, type MorphSelectProps } from '@/components/arc/morph-select/morph-select'

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
