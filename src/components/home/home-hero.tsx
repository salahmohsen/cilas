'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { TextMorph } from '@/components/arc/text-morph/text-morph'
import { TextReveal } from '@/components/arc/text-reveal/text-reveal'
import { HomeNumbers, type HomeStat } from '@/components/home/home-numbers'
import { HomeScene } from '@/components/home/home-scene'
import { Link } from '@/i18n/navigation'

type Action = { label: string; href: string }
/** The main action while it can't be taken: its label, and why, with where to go instead. */
type Closed = { label: string; note: string; link: Action }

/** How long each audience stays before the next takes its place. */
const STEP = 2400

/**
 * The home page's opening, the whole first screen: the motto over a felucca
 * drawn in the ink of the logo, who CILAS is for, one after another, and the
 * institute in numbers along the water. The list runs once and rests on its
 * last line; with reduced motion it starts there. While any of it is under
 * the header, the header stays clear.
 */
export function HomeHero({
  title,
  text,
  who,
  primary,
  secondary,
  numbers,
  locale,
}: {
  title: string
  text: string
  who: string[]
  /** Unavailable: the button shows but does nothing, and the note says why. */
  primary: Action | Closed
  secondary: Action
  numbers: { title: string; stats: HomeStat[] }
  locale: string
}) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const last = who.length - 1
  // The server renders the first line; with reduced motion the list jumps to its last line once hydrated, so both renders agree.
  const shown = index

  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndex(last)
      return
    }
    if (index >= last) return
    const timer = window.setTimeout(() => setIndex((i) => i + 1), STEP)
    return () => window.clearTimeout(timer)
  }, [index, last, reduced])

  // data-over-hero on <html> while the hero shows below the header's bottom edge.
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const hero = ref.current
    if (!hero) return
    const root = document.documentElement
    const header =
      parseFloat(getComputedStyle(root).getPropertyValue('--site-header-height')) || 64
    const observer = new IntersectionObserver(
      ([entry]) => root.toggleAttribute('data-over-hero', entry.isIntersecting),
      { rootMargin: `-${header}px 0px 0px 0px` },
    )
    observer.observe(hero)
    return () => {
      observer.disconnect()
      root.removeAttribute('data-over-hero')
    }
  }, [])

  return (
    <section aria-labelledby="home-title" className="home-hero" ref={ref}>
      <HomeScene />
      <div className="home-hero-inner">
        <TextReveal as="h1" className="home-hero-title" id="home-title" text={title} />
        <p className="home-hero-text">{text}</p>
        {/* Read once, whole, by screen readers; the moving line is for the eye. */}
        <p className="sr-only">{who.join(locale === 'ar' ? '، ' : ', ')}</p>
        <p aria-hidden className="home-hero-who">
          {locale === 'ar' ? (
            // Arabic letters join, so the line changes whole instead of letter by
            // letter. Leaving and arriving lines share one grid cell and
            // crossfade in place: popLayout's absolute positioning is measured
            // from the left and threw the leaving line aside in RTL.
            <span className="home-hero-who-stack">
              <AnimatePresence initial={false}>
                <motion.span
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  key={shown}
                  transition={{ duration: 0.35, ease: [0.2, 0, 0, 1] }}
                >
                  {who[shown]}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : (
            <TextMorph>{who[shown] ?? ''}</TextMorph>
          )}
        </p>
        <div className="home-hero-actions">
          {'href' in primary ? (
            <Link className="home-action" data-primary href={primary.href}>
              {primary.label}
            </Link>
          ) : (
            // aria-disabled rather than disabled: it stays reachable, so keyboard and screen-reader users meet the note too.
            <button
              aria-describedby="home-hero-note"
              aria-disabled
              className="home-action"
              data-primary
              type="button"
            >
              {primary.label}
            </button>
          )}
          <Link className="home-action" href={secondary.href}>
            {secondary.label}
          </Link>
        </div>
        {'note' in primary ? (
          <p className="home-hero-note" id="home-hero-note">
            {primary.note} <a href={primary.link.href}>{primary.link.label}</a>
          </p>
        ) : null}
      </div>
      <HomeNumbers locale={locale} stats={numbers.stats} title={numbers.title} />
    </section>
  )
}
