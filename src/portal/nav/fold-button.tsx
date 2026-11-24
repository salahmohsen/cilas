'use client'

import { ChevronLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/arc/button/button'
import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { isRtl } from '@/i18n/routing'

import { PORTAL_NAV_ID } from './fold'
import { useFold } from './fold-state'
import styles from './shell.module.css'

/** The fold button, where focus goes when the More sheet closes because the window grew past the phone layout. */
export const foldButton = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-portal-fold]')

/** Folds and unfolds the sidebar from the brand row. */
export function FoldButton() {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const { folded, toggle, shortcutOn } = useFold()
  const label = t(folded ? 'fold.unfold' : 'fold.fold')
  return (
    <Tooltip
      side={isRtl(locale) ? 'left' : 'right'}
      content={
        shortcutOn ? (
          <span>
            {label} <bdi dir="ltr">[</bdi>
          </span>
        ) : (
          label
        )
      }
    >
      <Button
        type="button"
        variant="ghost"
        className={styles.fold}
        aria-expanded={!folded}
        aria-controls={PORTAL_NAV_ID}
        aria-keyshortcuts={shortcutOn ? '[' : undefined}
        aria-label={label}
        data-portal-fold
        onClick={toggle}
      >
        <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" className={styles.chevron} />
      </Button>
    </Tooltip>
  )
}
