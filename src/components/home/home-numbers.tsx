'use client'

import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { motionTokens } from '@/components/arc/motion-tokens'
import { numberingSystemOf } from '@/lib/digits'

export type HomeStat = { value: number; label: string }

type Bezier = [number, number, number, number]
const enter = [...motionTokens.ease.enter] as Bezier

/** When the row fades in (the CSS delay of .home-numbers), and how long the count runs. */
const RISE_MS = 900
const DURATION = 1.6

/** Fixed per language, so the server and the client write the same digits. */
const formatter = (locale: string) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    numberingSystem: numberingSystemOf(locale),
  })

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
  const row = useRef<HTMLElement>(null)
  const values = useRef<(HTMLSpanElement | null)[]>([])
  // A primitive, so the hero's re-renders (its rotating line) don't restart the count.
  const targets = stats.map((stat) => stat.value).join(',')
  const digits = formatter(locale)

  useEffect(() => {
    if (reduced || !row.current) return
    // The row fades in on its own clock, from first paint. Hydrated after it
    // has shown, the final values stay: counting from zero then would flash.
    const rise = row.current.getAnimations()[0]
    const elapsed = Number(rise?.currentTime ?? Infinity)
    if (elapsed >= RISE_MS) return
    const { format } = formatter(locale)
    const nodes = values.current
    const finals = targets.split(',').map(Number)
    const controls = finals.map((final, i) => {
      const el = nodes[i]
      if (!el) return null
      el.textContent = format(0)
      return animate(0, final, {
        delay: (RISE_MS - elapsed) / 1000,
        duration: DURATION,
        ease: enter,
        onUpdate: (v) => {
          el.textContent = format(Math.round(v))
        },
      })
    })
    return () => {
      controls.forEach((control, i) => {
        control?.stop()
        const el = nodes[i]
        if (el) el.textContent = format(finals[i])
      })
    }
  }, [reduced, targets, locale])

  return (
    <section aria-labelledby="home-numbers-title" className="home-numbers" ref={row}>
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
                {digits.format(stat.value)}
              </span>
              <span className="sr-only">{digits.format(stat.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
