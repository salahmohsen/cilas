'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button } from '../../button/button'
import styles from './logo-marquee.module.css'

export interface LogoMarqueeBrand {
  name: string
  /** Monochrome SVG, drawn as a mask in the text color. Leave out to show the name alone. */
  icon?: string
  /** Single brand color for the mark in color tone. Leave out for brands whose mark is black or white. */
  color?: string
  /** Full color SVG for multicolor marks, used in color tone instead of `icon`. */
  colorIcon?: string
  /** Where the name leads, such as the outlet's coverage. */
  href?: string
  /** A full logo (wordmark included), shown in place of the mark and the name; the name becomes its alt text. */
  logo?: string
}

export interface LogoMarqueeLabels {
  /** Names the row of logos. */
  list: string
  play: string
  pause: string
  playLabel: string
  pauseLabel: string
  paused: string
}

/** Seconds for one full pass of the list. */
const CYCLE_SECONDS = 39
/** Pixels a pointer moves before a press becomes a drag. */
const DRAG_THRESHOLD = 5

const DEFAULT_LABELS: LogoMarqueeLabels = {
  list: 'Illustrative tool logos',
  play: 'Play',
  pause: 'Pause',
  playLabel: 'Play logo motion',
  pauseLabel: 'Pause logo motion',
  paused: 'Motion paused',
}

export type LogoMarqueeTone = 'color' | 'mono'

export interface LogoMarqueeProps {
  title?: string
  description?: string
  brands?: LogoMarqueeBrand[]
  /** `color` shows each mark in its official colors; `mono` draws every mark in the text color. */
  tone?: LogoMarqueeTone
  /** The section's own words, in the page's language. */
  labels?: Partial<LogoMarqueeLabels>
}

const exampleBrands: LogoMarqueeBrand[] = [
  { name: 'Figma', icon: '/block-logos/figma.svg', colorIcon: '/block-logos/figma-color.svg' },
  { name: 'Linear', icon: '/block-logos/linear.svg', color: '#5E6AD2' },
  { name: 'Notion', icon: '/block-logos/notion.svg' },
  { name: 'Slack', icon: '/block-logos/slack.svg', colorIcon: '/block-logos/slack-color.svg' },
  { name: 'GitHub', icon: '/block-logos/github.svg' },
  { name: 'Stripe', icon: '/block-logos/stripe.svg', color: '#635BFF' },
  { name: 'Vercel', icon: '/block-logos/vercel.svg' },
]

function BrandMark({ brand, tone }: { brand: LogoMarqueeBrand; tone: LogoMarqueeTone }) {
  if (!brand.icon && !brand.colorIcon) return null
  if (tone === 'color' && brand.colorIcon) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        className={styles.brandMark}
        src={brand.colorIcon}
        alt=""
        width={22}
        height={22}
        draggable={false}
      />
    )
  }
  return (
    <span
      className={styles.brandMark}
      style={{
        maskImage: `url("${brand.icon}")`,
        WebkitMaskImage: `url("${brand.icon}")`,
        color: tone === 'color' ? brand.color : undefined,
      }}
      aria-hidden="true"
    />
  )
}

function BrandList({
  brands,
  tone,
  duplicate = false,
  label,
}: {
  brands: LogoMarqueeBrand[]
  tone: LogoMarqueeTone
  duplicate?: boolean
  label: string
}) {
  return (
    <ul
      className={styles.brandList}
      aria-label={duplicate ? undefined : label}
      aria-hidden={duplicate || undefined}
    >
      {brands.map((brand, index) => {
        const content = brand.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.brandLogo} src={brand.logo} alt={brand.name} draggable={false} />
        ) : (
          <>
            <BrandMark brand={brand} tone={tone} />
            <span className={styles.brandName} dir="auto">
              {brand.name}
            </span>
          </>
        )
        return (
          <li className={styles.brand} key={`${brand.name}-${index}`}>
            {brand.href ? (
              // The copy that completes the loop is hidden, so its links leave the tab order.
              <a
                className={styles.brandLink}
                href={brand.href}
                rel="noopener noreferrer"
                tabIndex={duplicate ? -1 : undefined}
                target="_blank"
              >
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function LogoMarquee({
  title = 'Good work moves between tools',
  description = 'From the first idea to the final handoff, a familiar set of tools stays close to the work.',
  brands = exampleBrands,
  tone = 'color',
  labels: labelsProp,
}: LogoMarqueeProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const titleId = useId()
  const [paused, setPaused] = useState(false)
  const track = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const hovering = useRef(false)
  const drag = useRef<{ x: number; start: number; moved: boolean } | null>(null)
  const pausedRef = useRef(paused)
  const reducedRef = useRef(false)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // The row moves on its own, and a drag moves it by hand in either
  // direction. The offset wraps at half the track (one copy of the list).
  useEffect(() => {
    const el = track.current
    if (!el) return
    // With reduced motion every logo shows at once, wrapped (see the CSS):
    // nothing moves, by itself or by hand.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reducedRef.current = reduced
    if (reduced) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const half = el.scrollWidth / 2
      const still = pausedRef.current || hovering.current || drag.current
      if (!still && half) offset.current += (half / CYCLE_SECONDS) * ((now - last) / 1000)
      if (half) offset.current = ((offset.current % half) + half) % half
      el.style.transform = `translateX(${-offset.current}px)`
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedRef.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = { x: e.clientX, start: offset.current, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (d.moved) offset.current = d.start - dx
  }
  const endDrag = () => {
    // Clear after the click that follows a drag, so it does not open a link.
    setTimeout(() => {
      drag.current = null
    }, 0)
  }

  return (
    <section className={styles.section} data-tone={tone} aria-labelledby={titleId}>
      <div className={styles.intro}>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
      </div>

      {/* The loop runs left to right in both directions; each name keeps its own. */}
      <div
        className={styles.marquee}
        role="region"
        aria-label={labels.list}
        dir="ltr"
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onPointerCancel={endDrag}
        onPointerDown={onPointerDown}
        onPointerEnter={(e) => {
          if (e.pointerType === 'mouse') hovering.current = true
        }}
        onPointerLeave={() => {
          hovering.current = false
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
      >
        <div className={styles.track} ref={track}>
          <BrandList brands={brands} tone={tone} label={labels.list} />
          <BrandList brands={brands} tone={tone} label={labels.list} duplicate />
        </div>
      </div>

      <div className={styles.footer}>
        <Button
          variant="ghost"
          size="sm"
          className={styles.motionButton}
          aria-label={paused ? labels.playLabel : labels.pauseLabel}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? (
            <>
              <Play size={16} strokeWidth={1.75} aria-hidden="true" />
              {labels.play}
            </>
          ) : (
            <>
              <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
              {labels.pause}
            </>
          )}
        </Button>
        <span className={styles.motionStatus} aria-live="polite">
          {paused ? labels.paused : ''}
        </span>
      </div>
    </section>
  )
}

export default LogoMarquee
