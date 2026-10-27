'use client'

import { useTranslations } from 'next-intl'
import { RichField, type RichFieldProps } from '@/components/rich-field'
import type { SessionChoice } from './composer'

export type ComposerSuggestions = {
  mentions: { id: number; name: string }[]
  sessions?: SessionChoice[]
}

/** Creation and editing share the same writing tools and contextual suggestions. */
export function ComposerField({
  mentions,
  sessions = [],
  ...props
}: ComposerSuggestions & RichFieldProps) {
  const t = useTranslations('SpacePost')
  return (
    <RichField
      autoFocus
      minHeading={2}
      mentionSuggestions={mentions}
      description={t(sessions.length ? 'composeHintCourse' : 'composeHint')}
      sessionSuggestions={sessions.length ? sessions : undefined}
      sessionLabels={{ list: t('sessionList'), blocks: t('sessionBlocks') }}
      {...props}
    />
  )
}
