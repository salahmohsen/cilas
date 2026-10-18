'use client'

import { useEffect, useState } from 'react'

import { newTab } from './new-tab'

/**
 * Applying, kept in reach once the course details have scrolled away: on wide
 * screens a block that sticks at the end of the side column, on narrow ones a
 * bar along the bottom of the screen. It stays out of sight while the details'
 * own Apply button is still on screen, so the button never shows twice.
 */
export function RegisterBar({
  variant,
  status,
  price,
  applyLabel,
  applyUrl,
}: {
  variant: 'side' | 'bar'
  status: string
  price?: string | null
  applyLabel: string
  applyUrl: string
}) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // The details' Apply buttons (one per layout; only the visible one counts).
    const buttons = [...document.querySelectorAll<HTMLElement>('.course-apply[data-primary]')]
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
  }, [])

  return (
    <div aria-hidden={!shown || undefined} className="course-register" data-shown={shown || undefined} data-variant={variant} inert={!shown}>
      <div className="min-w-0">
        <span className="course-status" data-open>
          {status}
        </span>
        {price ? <span className="course-register-price">{price}</span> : null}
      </div>
      <a className="course-apply" href={applyUrl} {...newTab(applyUrl)}>
        {applyLabel}
      </a>
    </div>
  )
}
