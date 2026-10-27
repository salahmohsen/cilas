'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import styles from './space.module.css'

/**
 * The pinned cards in one row that scrolls sideways: touch, trackpad and the
 * keyboard scroll it natively, and the two buttons move it a card at a time
 * for a mouse. They sit in the section's head, beside its title. The row
 * follows the page's direction, so in Arabic it starts at the right. The Arc carousel centres one slide and makes the others
 * inert, and its drag maths assume left to right; here every card stays a
 * link.
 */
export function PinnedScroller({
  label,
  previous,
  next,
  head,
  children,
}: {
  label: string
  previous: string
  next: string
  /** The section's title and links, which the buttons join at the trailing end */
  head: ReactNode
  children: ReactNode
}) {
  const row = useRef<HTMLUListElement>(null)
  const [ends, setEnds] = useState({ start: true, end: true })

  useEffect(() => {
    const el = row.current
    if (!el) return
    const read = () => {
      // scrollLeft runs from 0 toward negative values in a right-to-left row.
      const moved = Math.abs(el.scrollLeft)
      setEnds({ start: moved < 2, end: moved + el.clientWidth >= el.scrollWidth - 2 })
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    const resize = new ResizeObserver(read)
    resize.observe(el)
    return () => {
      el.removeEventListener('scroll', read)
      resize.disconnect()
    }
  }, [])

  const move = (forward: boolean) => {
    const el = row.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    const step = (card?.offsetWidth ?? el.clientWidth) + gap
    const rtl = getComputedStyle(el).direction === 'rtl'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: (forward !== rtl ? 1 : -1) * step,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }

  const overflow = !(ends.start && ends.end)
  return (
    <>
      <div className={styles.pinnedHead}>
        {head}
        {overflow && (
          <div className={styles.pinnedControls}>
            <button
              type="button"
              className={styles.pinnedNav}
              aria-label={previous}
              disabled={ends.start}
              onClick={() => move(false)}
            >
              <ChevronLeft
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className={styles.flipInRtl}
              />
            </button>
            <button
              type="button"
              className={styles.pinnedNav}
              aria-label={next}
              disabled={ends.end}
              onClick={() => move(true)}
            >
              <ChevronRight
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className={styles.flipInRtl}
              />
            </button>
          </div>
        )}
      </div>
      <ul ref={row} className={styles.pinnedRow} aria-label={label}>
        {children}
      </ul>
    </>
  )
}
