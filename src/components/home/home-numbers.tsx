'use client'

import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { localDigits } from '@/lib/digits'

export type HomeStat = { value: number; label: string }

/** The count starts as the row fades in under the drawn scene (see .home-numbers). */
const DELAY = 0.9
const DURATION = 1.6

/**
 * CILAS in numbers, along the bottom of the hero. The server writes the final
 * values; once hydrated, each counts up from zero while the row fades in. The
 * moving digits are hidden from screen readers, which read the final value.
 */
export function HomeNumbers({
  stats,
  title,
  locale,
}: {
  stats: HomeStat[]
  title: string
  locale: string
}) {
  const reduced = useReducedMotion()
  const values = useRef<(HTMLSpanElement | null)[]>([])
  // A primitive, so the hero's re-renders (its rotating line) don't restart the count.
  const targets = stats.map((stat) => stat.value).join(',')

  useEffect(() => {
    if (reduced) return
    const nodes = values.current
    const finals = targets.split(',').map(Number)
    const controls = finals.map((final, i) => {
      const el = nodes[i]
      if (!el) return null
      el.textContent = localDigits(0, locale)
      return animate(0, final, {
        delay: DELAY,
        duration: DURATION,
        ease: [0.2, 0, 0, 1],
        onUpdate: (v) => {
          el.textContent = localDigits(Math.round(v), locale)
        },
      })
    })
    return () => {
      controls.forEach((control, i) => {
        control?.stop()
        const el = nodes[i]
        if (el) el.textContent = localDigits(finals[i], locale)
      })
    }
  }, [reduced, targets, locale])

  return (
    <section aria-labelledby="home-numbers-title" className="home-numbers">
      <h2 className="sr-only" id="home-numbers-title">
        {title}
      </h2>
      <dl className="home-numbers-list">
        {stats.map((stat, i) => (
          <div className="home-number" key={stat.label}>
            <dt className="home-number-label">{stat.label}</dt>
            <dd className="home-number-value">
              <span
                aria-hidden
                ref={(el) => {
                  values.current[i] = el
                }}
              >
                {localDigits(stat.value, locale)}
              </span>
              <span className="sr-only">{localDigits(stat.value, locale)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
