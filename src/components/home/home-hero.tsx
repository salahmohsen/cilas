'use client'

import { listSeparator } from '@/lib/locale-format'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'

import { TextMorph } from '@/components/arc/text-morph/text-morph'
import { HomeNumbers, type HomeStat } from '@/components/home/home-numbers'
import { Link } from '@/i18n/navigation'
import { scrollToSection } from '@/lib/scroll-to-section'

type Action = { label: string; href: string }
/** The main action while it can't be taken: its label, and why, with where to go instead. */
type Closed = { label: string; note: string; link?: Action }

/** How long each audience stays before the next takes its place. */
const STEP = 2400

/** An element's used translate in px, so a rect held by a running animation can be read back to rest. */
function usedTranslate(el: Element) {
  const parts = getComputedStyle(el).translate.split(' ')
  const x = parseFloat(parts[0])
  const y = parts.length > 1 ? parseFloat(parts[1]) : NaN
  return [Number.isNaN(x) ? 0 : x, Number.isNaN(y) ? 0 : y] as [number, number]
}

/** An element's used scale, which stands at 1 when it isn't scaling. */
function usedScale(el: Element) {
  const scale = parseFloat(getComputedStyle(el).scale)
  return Number.isNaN(scale) ? 1 : scale
}

/**
 * Points the scene's boat at the header's brand mark: measuring both, it sets
 * --sail-x, --sail-y and --sail-scale on the boat's track, so sail-out (in
 * home-scene.module.css) lands the boat on the mark, sized like it. On Arabic
 * pages the scene is mirrored, so the local flight reads the other way. Runs
 * once laid out and again on any resize, so a load of type or a turn of the
 * window re-aims the flight.
 */
function useSailAim(hero: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const track = hero.current?.querySelector<HTMLElement>('[data-sail-track]')
    const brand = document.querySelector<HTMLElement>('.site-header [data-brand]')
    const mark = brand?.querySelector<SVGSVGElement>('[data-site-mark]')
    if (!track || !brand || !mark) return
    const aim = () => {
      // The scene is mirrored on Arabic pages, which flips every local
      // x-delta's sign on screen: -1 there, 1 in left-to-right.
      const mirror = document.documentElement.dir === 'rtl' ? -1 : 1
      // A scroll-driven animation holds its share of the flight in the rect
      // while the page sits mid-scroll, so the track's own translate comes
      // off, back to the boat's place at rest; scale is about the boat's
      // center, so it never moves that center.
      const [tx, ty] = usedTranslate(track)
      const boat = track.getBoundingClientRect()
      const boatX = boat.x + boat.width / 2 - mirror * tx
      const boatY = boat.y + boat.height / 2 - ty + window.scrollY
      // Hidden while the hero's name is on screen, the brand sits 0.5em low;
      // its own translate lifts the mark back to where it rests shown. And the
      // header sticks at the top once the deadlines bar above it has scrolled
      // away, which it long has by the flight's end: the mark is read where
      // the header is stuck, not wherever the bar has left it.
      const [brandTx, brandTy] = usedTranslate(brand)
      const markRect = mark.getBoundingClientRect()
      const stuckFrom = brand.closest('header')?.offsetTop ?? 0
      const markX = markRect.x + markRect.width / 2 - brandTx
      const markY =
        markRect.y +
        markRect.height / 2 -
        brandTy +
        window.scrollY -
        Math.max(window.scrollY, stuckFrom)
      // The flight ends when its range does, 90vh scrolled: the boat must
      // also catch up the distance its own rest place has travelled by then.
      // In the mirrored scene a local leftward translate sails it right.
      const x = mirror * (markX - boatX)
      const y = markY - boatY + window.innerHeight * 0.9
      const scaleToMark = Math.min(
        0.5,
        Math.max(0.08, markRect.height / Math.max(boat.height / usedScale(track), 1)),
      )
      track.style.setProperty('--sail-x', `${x.toFixed(1)}px`)
      track.style.setProperty('--sail-y', `${y.toFixed(1)}px`)
      track.style.setProperty('--sail-scale', `${scaleToMark.toFixed(3)}`)
    }
    aim()
    const resize = new ResizeObserver(aim)
    resize.observe(document.body)
    window.addEventListener('resize', aim)
    return () => {
      resize.disconnect()
      window.removeEventListener('resize', aim)
    }
  }, [hero])
}

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

  // The voyage home: the scene's boat flies to the header's brand mark over
  // the scroll (sail-out in home-scene.module.css), which needs the flight in
  // px. This measures the mark and the boat and sets --sail-x, --sail-y and
  // --sail-scale on the boat's track, so the boat lands on the mark, sized
  // like it, and fades away with the water on the very same scroll range.
  useSailAim(ref)

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
        {text ? (
          <p className="home-hero-text home-hero-rise" style={step(0)}>
            {text}
          </p>
        ) : null}
        {/* Read once, whole, by screen readers; the moving line is for the eye. */}
        <p className="sr-only">{who.join(listSeparator(locale))}</p>
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
            <Link
              className="home-action"
              data-primary
              href={primary.href}
              onClick={(event) => {
                // A section on this page: scroll there on every click, not only
                // the first (the same hash again is no navigation).
                const hash = primary.href.split('#')[1]
                if (hash && scrollToSection(hash, { reduced: Boolean(reduced) }))
                  event.preventDefault()
              }}
            >
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
