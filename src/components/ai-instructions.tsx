'use client'

import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { HoverCard } from '@/components/arc/hover-card/hover-card'
import styles from './ai-instructions.module.css'

export function AIInstructions() {
  const t = useTranslations('Share')

  return (
    <HoverCard
      align="end"
      content={
        <ol className={styles.steps}>
          {(t.raw('aiSteps') as string[]).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      }
    >
      <button type="button" className={styles.trigger} aria-label={t('aiInstructions')}>
        <Info size={16} aria-hidden="true" />
      </button>
    </HoverCard>
  )
}
