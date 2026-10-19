'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { TextMorph } from '@/components/arc/text-morph/text-morph'
import { HomeNumbers, type HomeStat } from '@/components/home/home-numbers'
import { Link } from '@/i18n/navigation'

type Action = { label: string; href: string }
/** The main action while it can't be taken: its label, and why, with where to go instead. */
type Closed = { label: string; note: string; link?: Action }

/** How long each audience stays before the next takes its place. */
const STEP = 2400

/**
 * Sets --hero-offset (see the effect below) while the HTML is still being
 * parsed, so the first paint already has the hero's final height and nothing
 * moves when the page hydrates. It runs where it stands, first in the hero.
 */
const OFFSET_NOW =
  "(function(h){h.style.setProperty('--hero-offset',h.getBoundingClientRect().top+scrollY+'px')})(document.currentScript.parentElement)"

/** Its place in the entrance, after the title: text, who, actions, … */
const step = (n: number) => ({ '--step': n }) as CSSProperties

/**
 * The home page's opening, the rest of the first screen: the institute's
 * name over the logo's felucca at sea, who CILAS is for, one after another,
 * and the institute in numbers. The list goes round without end; with
 * reduced motion it stays still, on its last line. The name and the boat
 * stand in for the header's brand, which stays hidden until the name has
 * scrolled away.
 */
export function HomeHero({
  title,
  text,
  who,
  primary,
  secondary,
  numbers,
  scene,
  locale,
}: {
  /** Broken into lines at each newline. */
  title: string
  text: string
  who: string[]
  /** Unavailable: the button shows but does nothing, and the note says why. */
  primary: Action | Closed
  secondary: Action
  numbers: { title: string; stats: HomeStat[] }
  /** The drawing behind it all (HomeScene), rendered on the server. */
  scene: ReactNode
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
    // Round and round: after the last line comes the first again.
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % who.length), STEP)
    return () => window.clearTimeout(timer)
  }, [index, last, reduced, who.length])

  // Whatever sits above the hero (the deadlines bar, until dismissed, and the
  // header) pushes it down; it gives that much back, so it ends at the fold.
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const hero = ref.current
    if (!hero) return
    const offset = () =>
      hero.style.setProperty(
        '--hero-offset',
        `${hero.getBoundingClientRect().top + window.scrollY}px`,
      )
    offset()
    const resize = new ResizeObserver(offset)
    resize.observe(document.body)
    return () => resize.disconnect()
  }, [])

  // data-brand-shown on <html> once the title has gone up under the header:
  // the header's brand, mark and name, comes back then (see styles.css).
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const heading = titleRef.current
    if (!heading) return
    const root = document.documentElement
    const header = parseFloat(getComputedStyle(root).getPropertyValue('--site-header-height')) || 64
    const observer = new IntersectionObserver(
      (entries) =>
        root.toggleAttribute('data-brand-shown', !entries[entries.length - 1].isIntersecting),
      { rootMargin: `-${header}px 0px 0px 0px` },
    )
    observer.observe(heading)
    return () => {
      observer.disconnect()
      root.removeAttribute('data-brand-shown')
    }
  }, [])

  return (
    // The script below sets the section's --hero-offset before React hydrates,
    // so the client finds a style attribute the server never rendered; on
    // purpose, and the effect above keeps it, so React need not warn.
    <section aria-labelledby="home-title" className="home-hero" ref={ref} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: OFFSET_NOW }} />
      {scene}
      <div className="home-hero-inner">
        <h1 className="home-hero-title" id="home-title" ref={titleRef}>
          {title.split('\n').map((line, i) => (
            // Each line rises out of its own mask, one after the other.
            <span className="home-hero-line" key={line} style={{ '--line': i } as CSSProperties}>
              {i > 0 ? ' ' : null}
              <span>{line}</span>
            </span>
          ))}
        </h1>
        <p className="home-hero-text home-hero-rise" style={step(0)}>
          {text}
        </p>
        {/* Read once, whole, by screen readers; the moving line is for the eye. */}
        <p className="sr-only">{who.join(locale === 'ar' ? '، ' : ', ')}</p>
        <p aria-hidden className="home-hero-who home-hero-rise" style={step(1)}>
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
        <div className="home-hero-actions home-hero-rise" style={step(2)}>
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
          <p className="home-hero-note home-hero-rise" id="home-hero-note" style={step(3)}>
            {primary.note}
            {primary.link ? (
              <>
                {' '}
                <a href={primary.link.href}>{primary.link.label}</a>
              </>
            ) : null}
          </p>
        ) : null}
        <HomeNumbers locale={locale} stats={numbers.stats} title={numbers.title} />
      </div>
    </section>
  )
}
