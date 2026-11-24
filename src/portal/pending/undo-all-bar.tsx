'use client'

import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/arc/button/button'
import { announce } from '@/portal/feedback/announce'
import { usePending } from './pending-provider'
import styles from './pending.module.css'

const BAR_SIZE = '--pending-bar-block-size'
const TOAST_OFFSET = '--toast-stack-offset'

export function UndoAllBar() {
  const pending = usePending()
  const t = useTranslations('Portal.pending')
  const bar = useRef<HTMLElement>(null)
  const announced = useRef(false)
  const n = pending.items.filter(
    ({ view }) => view.state === 'pending' || view.state === 'paused',
  ).length
  const visible = n >= 2

  useLayoutEffect(() => {
    if (visible && !announced.current) announce(t('bar.announce', { n }))
    announced.current = visible
  }, [visible, n, t])

  useLayoutEffect(() => {
    const node = bar.current
    if (!visible || !node) return
    const root = document.documentElement.style
    const priorOffset = root.getPropertyValue(TOAST_OFFSET)
    const measure = () => root.setProperty(BAR_SIZE, `${node.getBoundingClientRect().height}px`)
    measure()
    root.setProperty(TOAST_OFFSET, `calc(var(--portal-bottom-inset, 0px) + var(${BAR_SIZE}, 0px))`)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(node)
    return () => {
      observer?.disconnect()
      root.removeProperty(BAR_SIZE)
      if (priorOffset) root.setProperty(TOAST_OFFSET, priorOffset)
      else root.removeProperty(TOAST_OFFSET)
    }
  }, [visible])

  if (!visible) return null
  return (
    <section ref={bar} className={styles.bar} aria-label={t('bar.label')} data-pending-bar>
      <div className={styles.copy}>
        <p className={styles.count}>{t('bar.count', { n })}</p>
        <p>{t('leaveHint')}</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={() => {
          const focus = pending.undoAll()
          if (focus) requestAnimationFrame(focus)
        }}
      >
        {t('bar.undoAll')}
      </Button>
    </section>
  )
}
