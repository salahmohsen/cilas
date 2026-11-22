'use client'

import { catchError } from 'next/error'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/arc/button/button'

import styles from './needs.module.css'

/** Wraps one section: if it throws, that section shows "This could not load." with **Retry**, and the rest of the page stays. */
export const SectionBoundary = catchError(function SectionFallback(
  _props: object,
  { retry }: { retry: () => void },
) {
  const t = useTranslations('Portal.inbox')
  return (
    <div className={styles.failed} role="alert">
      <p>{t('failed')}</p>
      <Button type="button" variant="secondary" onClick={() => retry()}>
        {t('retry')}
      </Button>
    </div>
  )
})
