'use client'

import { ChevronLeft } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/arc/button/button'

import { PORTAL_NAV_ID } from './fold'
import { useFold } from './fold-state'
import styles from './shell.module.css'

/** The fold button, where focus goes when the More sheet closes because the window grew past the phone layout. */
export const foldButton = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-portal-fold]')

/** Folds and unfolds the sidebar, from the start of the page header row. */
export function FoldButton() {
  const t = useTranslations('Portal')
  const { folded, toggle } = useFold()
  return (
    <Button
      type="button"
      variant="ghost"
      className={styles.fold}
      aria-expanded={!folded}
      aria-controls={PORTAL_NAV_ID}
      aria-keyshortcuts="["
      aria-label={t('nav.sidebar')}
      data-portal-fold
      onClick={toggle}
    >
      <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
    </Button>
  )
}
