import type { CSSProperties } from 'react'

import { LOGO, LOGO_VIEWBOX } from './home-scene-logo'
import styles from './home-scene.module.css'

/** One row of sea: its height in the band, wavelength and height of a wave (px), ink weight. */
type Swell = { y: number; length: number; rise: number; w: number; at: number }

// Far rows are low, short and faint; near rows, tall and long.
const SWELLS: Swell[] = [
  { y: 18, length: 90, rise: 6, w: 1.5, at: 0 },
  { y: 42, length: 120, rise: 9, w: 2, at: 0.1 },
  { y: 70, length: 150, rise: 12, w: 2.5, at: 0.2 },
  { y: 102, length: 190, rise: 15, w: 3, at: 0.3 },
]

/** The widest screen the sea has to cover. */
const REACH = 3000

/**
 * A row of waves, starting at its svg's left edge, one wavelength wider than
 * the reach so it can roll a wavelength on. Each wave rises slow from a round
 * trough to a pointed crest and falls back, as swell does.
 */
const swell = ({ y, length, rise }: Swell) => {
  const half = length / 2
  const up = `c${half * 0.55} 0 ${half * 0.85} ${-rise * 0.55} ${half} ${-rise}`
  const down = `c${half * 0.15} ${rise * 0.45} ${half * 0.45} ${rise} ${half} ${rise}`
  return `M0 ${y}` + ` ${up} ${down}`.repeat(Math.ceil((REACH + 2 * length) / length))
}

/** The water under a row's line, down past the band's foot: it hides what sits behind it. */
const body = (row: Swell) => `${swell(row)} V400 H0 Z`

/**
 * Rows of sea, each its line and the water under it. Every row is its own
 * svg, set one wavelength left of the edge, and the svg itself rolls: moving
 * a whole element, the browser hands the motion to the GPU, where moving
 * shapes inside an svg would repaint it on the main thread every frame. The
 * far rows go behind the boat, the near ones in front, so its hull sits in
 * the water and dips under the near swell as it rides.
 */
function Sea({ rows, from }: { rows: Swell[]; from: number }) {
  return (
    <div className={styles.water}>
      {rows.map((row, n) => (
        // No viewBox: the waves are drawn in pixels, so they keep their shape
        // at any width, and the band shows as much sea as it is wide.
        <svg
          className={styles.swell}
          fill="none"
          height="100%"
          key={row.y}
          stroke="currentColor"
          strokeLinecap="round"
          style={{ '--i': from + n, '--length': `${row.length}px` } as CSSProperties}
          width={REACH + 2 * row.length}
        >
          <path className={styles.sea} d={body(row)} />
          <path
            className={styles.wave}
            d={swell(row)}
            pathLength={1}
            strokeWidth={row.w}
            style={at(row.at)}
          />
        </svg>
      ))}
    </div>
  )
}

/** Each bird's place in the sky's 600 × 200 frame, and its size. */
const BIRDS = [
  { x: 40, y: 120, s: 1.2 },
  { x: 150, y: 60, s: 0.9 },
  { x: 260, y: 140, s: 0.7 },
  { x: 360, y: 40, s: 1 },
  { x: 470, y: 100, s: 0.6 },
  { x: 540, y: 160, s: 0.8 },
]

const at = (seconds: number) => ({ '--at': `${seconds}s` }) as CSSProperties

/**
 * The home hero's scene in the ink of the CILAS logo: birds in the sky, and
 * the logo's own felucca riding rows of waves. Strokes take the text colour,
 * so it follows the theme; all motion is CSS, and none of it runs with
 * reduced motion. A server component: HomeHero takes it as a prop, so none of
 * its drawing ships in the page's JavaScript.
 */
export function HomeScene() {
  return (
    <div aria-hidden className={styles.scene}>
      {/* Each bird its own svg, gliding as a whole: see Sea. */}
      <div className={styles.birds}>
        {BIRDS.map((bird, i) => (
          <svg
            className={styles.bird}
            fill="none"
            key={i}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={
              {
                ...at(0.9 + i * 0.08),
                '--i': i,
                left: `${(bird.x / 600) * 100}%`,
                top: `${(bird.y / 200) * 100}%`,
                width: `${((44 * bird.s) / 600) * 100}%`,
              } as CSSProperties
            }
            viewBox="-2 -14 44 16"
          >
            <path d="M0 0 Q 10 -12 20 0 Q 30 -12 40 0" pathLength={1} strokeWidth={3} />
          </svg>
        ))}
      </div>

      <Sea from={0} rows={SWELLS.slice(0, 2)} />

      {/* The track carries the scroll-linked voyage, the boat its riding of the waves. */}
      <div className={styles.track}>
        <div className={styles.boat}>
          {/* The sail and the hull, two svgs in one frame: the sail leans as a
              whole element (see Sea), over a hull that stays put. */}
          <svg
            className={styles.sail}
            fill="currentColor"
            fillRule="evenodd"
            viewBox={LOGO_VIEWBOX}
          >
            {LOGO.filter((shape) => shape.part !== 'hull').map((shape) => (
              <path className={styles[shape.part]} d={shape.d} key={shape.d} style={at(shape.at)} />
            ))}
          </svg>
          <svg
            className={styles.hullFrame}
            fill="currentColor"
            fillRule="evenodd"
            viewBox={LOGO_VIEWBOX}
          >
            {LOGO.filter((shape) => shape.part === 'hull').map((shape) => (
              <path className={styles.hull} d={shape.d} key={shape.d} style={at(shape.at)} />
            ))}
          </svg>
        </div>
      </div>

      <Sea from={2} rows={SWELLS.slice(2)} />
    </div>
  )
}
