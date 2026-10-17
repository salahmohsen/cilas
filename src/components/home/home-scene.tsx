import type { CSSProperties } from 'react'

import styles from './home-scene.module.css'

/** Seconds into the draw-in each stroke starts. */
type Stroke = { d: string; w: number; at: number }

const WAVES: Stroke[] = [
  { d: 'M-40 30 C 200 18, 420 42, 700 28 S 1200 16, 1640 32', w: 2.5, at: 0 },
  { d: 'M120 62 C 380 50, 640 74, 900 60 S 1350 50, 1560 64', w: 2, at: 0.12 },
  { d: 'M-20 92 C 260 84, 520 102, 820 90 S 1300 80, 1620 96', w: 1.5, at: 0.24 },
  { d: 'M300 112 C 520 106, 760 118, 1040 110', w: 1, at: 0.36 },
]

// The sail of the CILAS logo: a mast, a leaning edge, brush stripes rising to it.
const SAIL: Stroke[] = [
  { d: 'M98 12 L92 212', w: 5, at: 0.3 },
  { d: 'M98 14 C 122 72, 150 140, 172 204 L 94 208', w: 4, at: 0.4 },
  { d: 'M96 54 L110 44', w: 8, at: 0.55 },
  { d: 'M95 86 L121 74', w: 9, at: 0.62 },
  { d: 'M95 120 L134 106', w: 10, at: 0.69 },
  { d: 'M94 156 L147 140', w: 11, at: 0.76 },
  { d: 'M93 188 L160 172', w: 12, at: 0.83 },
]

const HULL: Stroke[] = [
  { d: 'M28 212 L194 208', w: 5, at: 0.45 },
  { d: 'M28 214 C 74 246, 150 248, 194 208', w: 10, at: 0.5 },
]

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
 * The home hero's scene in the ink of the CILAS logo: birds in the sky, a
 * felucca on the water. Strokes take the text colour, so it follows the theme;
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
              <path d="M0 0 Q 7 -8 14 0 Q 21 -8 28 0" pathLength={1} strokeWidth={2.5} />
            </g>
          </g>
        ))}
      </svg>

      <svg
        className={styles.water}
        fill="none"
        preserveAspectRatio="none"
        stroke="currentColor"
        strokeLinecap="round"
        viewBox="0 0 1600 120"
      >
        {WAVES.map((wave, i) => (
          <path
            className={styles.wave}
            d={wave.d}
            key={i}
            pathLength={1}
            strokeWidth={wave.w}
            style={{ ...at(wave.at), '--i': i } as CSSProperties}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* The track carries the scroll-linked sail-out, the boat its bobbing. */}
      <div className={styles.track}>
        <div className={styles.boat}>
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 200 260"
          >
            <g className={styles.sail}>
              {SAIL.map((stroke, i) => (
                <path d={stroke.d} key={i} pathLength={1} strokeWidth={stroke.w} style={at(stroke.at)} />
              ))}
            </g>
            {HULL.map((stroke, i) => (
              <path d={stroke.d} key={i} pathLength={1} strokeWidth={stroke.w} style={at(stroke.at)} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}
