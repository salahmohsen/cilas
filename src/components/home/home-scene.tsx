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

/** The widest screen the sea has to cover, plus one wave to drift into. */
const REACH = 3000

/**
 * A row of waves from one wavelength before the edge. Each wave rises slow
 * from a round trough to a pointed crest and falls back, as swell does.
 */
const swell = ({ y, length, rise }: Swell) => {
  const half = length / 2
  const up = `c${half * 0.55} 0 ${half * 0.85} ${-rise * 0.55} ${half} ${-rise}`
  const down = `c${half * 0.15} ${rise * 0.45} ${half * 0.45} ${rise} ${half} ${rise}`
  return `M${-length} ${y}` + ` ${up} ${down}`.repeat(Math.ceil((REACH + length) / length))
}

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
 * the logo's own felucca riding rows of waves. Strokes take the text colour, so it follows the theme;
 * all motion is CSS, and none of it runs with reduced motion.
 */
export function HomeScene() {
  return (
    <div aria-hidden className={styles.scene}>
      <svg
        className={styles.birds}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 600 200"
      >
        {BIRDS.map((bird, i) => (
          <g key={i} transform={`translate(${bird.x} ${bird.y}) scale(${bird.s})`}>
            <g className={styles.bird} style={{ ...at(0.9 + i * 0.08), '--i': i } as CSSProperties}>
              <path d="M0 0 Q 10 -12 20 0 Q 30 -12 40 0" pathLength={1} strokeWidth={3} />
            </g>
          </g>
        ))}
      </svg>

      {/* No viewBox: the waves are drawn in pixels, so they keep their shape
          at any width, and the band shows as much sea as it is wide. */}
      <svg className={styles.water} fill="none" stroke="currentColor" strokeLinecap="round">
        {SWELLS.map((row, i) => (
          <path
            className={styles.wave}
            d={swell(row)}
            key={row.y}
            pathLength={1}
            strokeWidth={row.w}
            style={{ ...at(row.at), '--i': i, '--length': `${row.length}px` } as CSSProperties}
          />
        ))}
      </svg>

      {/* The track carries the scroll-linked voyage, the boat its riding of the waves. */}
      <div className={styles.track}>
        <div className={styles.boat}>
          <svg fill="currentColor" fillRule="evenodd" viewBox={LOGO_VIEWBOX}>
            <g className={styles.sail}>
              {LOGO.filter((shape) => shape.part !== 'hull').map((shape) => (
                <path
                  className={styles[shape.part]}
                  d={shape.d}
                  key={shape.d}
                  style={at(shape.at)}
                />
              ))}
            </g>
            {LOGO.filter((shape) => shape.part === 'hull').map((shape) => (
              <path className={styles.hull} d={shape.d} key={shape.d} style={at(shape.at)} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}
