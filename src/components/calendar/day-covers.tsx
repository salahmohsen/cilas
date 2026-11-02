'use client'

import { useEffect, useRef, useState } from 'react'

import type { FocalPoint } from '@/lib/media-image'
import { focalPointStyle } from '@/lib/media-image'

type Cover = { url: string; alt: string } & FocalPoint

/** The turn of a cover, in ms: long enough to read as a flip, short enough to stay quiet. */
const FLIP_MS = 800
/** The wait before the calendar turns its next cover, as in macOS's Album Artwork saver: one at a time, anywhere on the grid. */
const BETWEEN_FLIPS_MS = [1600, 3200] as const

/** Every day on the page that has several covers; one timer turns a random one of them. */
const flippers = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

const schedule = () => {
  const [min, max] = BETWEEN_FLIPS_MS
  timer = setTimeout(
    () => {
      const all = [...flippers]
      if (all.length && !document.hidden) all[Math.floor(Math.random() * all.length)]!()
      schedule()
    },
    min + Math.random() * (max - min),
  )
}

const join = (flip: () => void) => {
  flippers.add(flip)
  if (flippers.size === 1) schedule()
  return () => {
    flippers.delete(flip)
    if (!flippers.size) clearTimeout(timer)
  }
}

/**
 * A day's cover. With several, it turns over to the next now and then, on a
 * clock the whole calendar shares so the turns land at random, one at a time
 * (the macOS Album Artwork screen saver). The cover not showing waits on the
 * back of the card, so a turn never shows a blank.
 */
export function DayCovers({ covers }: { covers: Cover[] }) {
  const count = covers.length
  const [turns, setTurns] = useState(0)
  /** Which cover each face holds: the front starts on the first, the back on the second. */
  const [faces, setFaces] = useState([0, count > 1 ? 1 : 0])
  const showing = useRef(0)

  useEffect(() => {
    if (count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let settle: ReturnType<typeof setTimeout> | undefined
    const leave = join(() => {
      const next = (showing.current + 1) % count
      showing.current = next
      setTurns((t) => t + 1)
      // Once the turn has landed, the face now out of sight takes the cover after it.
      clearTimeout(settle)
      settle = setTimeout(() => {
        setFaces((f) => (f[0] === next ? [f[0], (next + 1) % count] : [(next + 1) % count, f[1]]))
      }, FLIP_MS + 50)
    })
    return () => {
      leave()
      clearTimeout(settle)
    }
  }, [count])

  return (
    <div className="cal-covers">
      <div className="cal-covers-turner" style={{ transform: `rotateY(${turns * 180}deg)` }}>
        {[0, 1].map((face) => {
          const cover = covers[faces[face]!]!
          return (
            <div className="cal-covers-face" data-face={face} key={face}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" decoding="async" src={cover.url} style={focalPointStyle(cover)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
