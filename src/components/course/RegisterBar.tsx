'use client'

import { useEffect, useState } from 'react'

import { SideCardApply } from '@/components/side-card'

import { newTab } from '@/lib/new-tab'

/**
 * Applying, kept in reach once the course details have scrolled away: on wide
 * screens a block that sticks at the end of the side column, on narrow ones a
 * bar along the bottom of the screen. It stays out of sight while the details'
 * own Apply button is still on screen, so the button never shows twice.
 */
export function RegisterBar({
  primaryIds,
  variant,
  status,
  price,
  applyLabel,
  applyUrl,
}: {
  primaryIds: readonly string[]
  variant: 'side' | 'bar'
  status: string
  price?: string | null
  applyLabel: string
  applyUrl: string
}) {
  const [shown, setShown] = useState(false)

  const primaryKey = primaryIds.join(' ')
  useEffect(() => {
    // The details' Apply buttons (one per layout; only the visible one counts).
    const buttons = primaryKey
      .split(' ')
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null)
    if (!buttons.length) return
    const update = () => {
      const visible = buttons.filter((b) => b.offsetParent !== null)
      setShown(visible.length > 0 && visible.every((b) => b.getBoundingClientRect().bottom < 0))
    }
    const observer = new IntersectionObserver(update)
    buttons.forEach((b) => observer.observe(b))
    window.addEventListener('resize', update)
    update()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [primaryKey])

  return (
    <div
      aria-hidden={!shown || undefined}
      className="course-register"
      data-shown={shown || undefined}
      data-variant={variant}
      inert={!shown}
    >
      {variant === 'side' ? (
        <SideCardApply
          applyLabel={applyLabel}
          applyUrl={applyUrl}
          newTab={Boolean(newTab(applyUrl).target)}
          open
          price={price}
          status={status}
        />
      ) : (
        <>
          <div className="min-w-0">
            <span className="course-status" data-open>
              {status}
            </span>
            {price ? <span className="course-register-price">{price}</span> : null}
          </div>
          <a className="course-apply" href={applyUrl} {...newTab(applyUrl)}>
            {applyLabel}
          </a>
        </>
      )}
    </div>
  )
}
