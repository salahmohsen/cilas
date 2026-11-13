'use client'

import { useEffect, useRef } from 'react'

import styles from './crowd-scene.module.css'

/**
 * The sheet of Open Peeps (openpeeps.com) the crowd is cut from: 15 people a
 * row, 7 rows. Adapted from Skiper UI's crowd canvas (skiper-ui.com/v1/skiper39),
 * itself after codepen.io/zadvorsky/pen/xxwbBQV. Twelve places hold people cut
 * from Open Peeps' standing figures at the same scale, in place of the four
 * holding a knife, the five with fangs and extra eyes, two people the sheet
 * had twice, and the bearded man in a headband.
 */
const SHEET = { src: '/assets/images/crowd-peeps.png', columns: 15, rows: 7 }

/** Every person's place on the sheet. */
const PEOPLE = Array.from({ length: SHEET.columns * SHEET.rows }, (_, i) => ({
  column: i % SHEET.columns,
  row: Math.floor(i / SHEET.columns),
}))

/**
 * A person's height against the band: as in the original, where a 324px
 * person stands in a crowd that reaches 150px above their head.
 */
const HEIGHT = 324 / 474

/** People per person's width: dense enough that each raised person's cut edge is behind those in front. */
const DENSITY = 8

/** One person on the sheet, and where and how they walk. */
type Peep = {
  column: number
  row: number
  /** Walking right (1) or left (-1); the drawing faces right. */
  direction: 1 | -1
  x: number
  /** Their drawing's top: lower is nearer, and drawn later. */
  y: number
  /** Px a second. */
  speed: number
  /** Seconds walked, which sets the bob of their step. */
  t: number
}

const random = (min: number, max: number) => min + Math.random() * (max - min)

/** Any CSS colour as [r, g, b], read back through `ctx` (whose first pixel it overwrites). */
function rgb(ctx: CanvasRenderingContext2D, color: string): [number, number, number] {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

/**
 * Redraw `image` (the sheet) on `sheet` at `cell` device px a person, in two
 * colours: its black in `ink`, its white in `paper`, and every grey between
 * in proportion. Every frame draws from this canvas, small and on the GPU:
 * drawing from a full-size sheet kept on the CPU cost iOS Safari about 400ms
 * a frame. The canvas is the only copy and is reused: iOS Safari caps all
 * canvases together (a few hundred MB) and frees old ones late, so making a
 * new full-size copy on each paint left it with none to draw on.
 */
function cast(
  sheet: HTMLCanvasElement,
  image: HTMLImageElement,
  cell: { w: number; h: number },
  ink: string,
  paper: string,
) {
  const ctx = sheet.getContext('2d')
  if (!ctx) return
  // Read the colours first: setting the size below clears the canvas anyway.
  const [ir, ig, ib] = rgb(ctx, ink)
  const [pr, pg, pb] = rgb(ctx, paper)
  sheet.width = cell.w * SHEET.columns
  sheet.height = cell.h * SHEET.rows
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, sheet.width, sheet.height)
  const pixels = ctx.getImageData(0, 0, sheet.width, sheet.height)
  const data = pixels.data
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const t = 1 - (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255
    data[i] = pr + (ir - pr) * t
    data[i + 1] = pg + (ig - pg) * t
    data[i + 2] = pb + (ib - pb) * t
  }
  ctx.putImageData(pixels, 0, 0)
}

/**
 * A crowd of people walking past along the hero's foot, both ways, each at
 * their own pace, packed as in the original: most stand low, cut by the
 * frame's foot; the few who stand higher are always behind those in front,
 * so no drawing's cut edge shows anywhere else. It draws in the theme's ink
 * and paper (crowd-scene.module.css) and redraws when the theme changes.
 * With reduced motion the crowd stands still; off screen it stops drawing.
 */
export function CrowdScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const image = new Image()
    /** The sheet at stage size in the theme's colours (see cast). */
    const sheet = document.createElement('canvas')
    /** What `sheet` was last cast for, so an unchanged paint costs nothing. */
    let castFor = ''
    /** A person's cell on `sheet`, in device px. */
    let cell = { w: 0, h: 0 }
    let stage = { w: 0, h: 0 }
    /** A person's size on the stage. */
    let size = { w: 0, h: 0 }
    let crowd: Peep[] = []

    const enter = (anywhere: boolean): Peep => {
      const direction = Math.random() > 0.5 ? 1 : -1
      const from = direction === 1 ? -size.w : stage.w
      const to = direction === 1 ? stage.w : -size.w
      // The original's spread: from 31% of a height below the frame's foot
      // to 46% above it, most near the foot (an ease-in of a random).
      const rise = size.h * (100 / 324 - (250 / 324) * Math.random() ** 2)
      return {
        ...PEOPLE[(Math.random() * PEOPLE.length) | 0],
        direction,
        x: anywhere ? random(from, to) : from,
        y: stage.h - size.h + rise,
        speed: size.h * random(0.25, 0.75),
        t: Math.random(),
      }
    }
    const nearLast = (a: Peep, b: Peep) => a.y - b.y

    const fill = () => {
      const count = Math.ceil(((stage.w + size.w) / size.w) * DENSITY)
      crowd = Array.from({ length: count }, () => enter(true)).sort(nearLast)
    }

    const draw = () => {
      const ratio = window.devicePixelRatio || 1
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, stage.w, stage.h)
      if (!castFor) return
      const bob = size.h * 0.03
      for (const peep of crowd) {
        // Up and down twice a second, eased at the top and the foot of each step.
        const phase = (peep.t / 0.25) % 2
        const lift = bob * (0.5 - 0.5 * Math.cos(Math.PI * (phase < 1 ? phase : 2 - phase)))
        // The drawing faces right; a left-walker is drawn mirrored about their own middle.
        const x = peep.direction === 1 ? peep.x : peep.x + size.w
        ctx.setTransform(ratio * peep.direction, 0, 0, ratio, x * ratio, (peep.y - lift) * ratio)
        ctx.drawImage(
          sheet,
          peep.column * cell.w,
          peep.row * cell.h,
          cell.w,
          cell.h,
          0,
          0,
          size.w,
          size.h,
        )
      }
    }

    /**
     * Cast the sheet for the stage's person size (at most the drawing's own)
     * and the theme's ink and paper (crowd-scene.module.css), unless it
     * already is: the theme watcher fires on any style change of <html>.
     */
    const paint = () => {
      const ratio = window.devicePixelRatio || 1
      const scale = Math.min(1, (size.h * ratio) / (image.naturalHeight / SHEET.rows))
      const next = {
        w: Math.max(1, Math.round((image.naturalWidth / SHEET.columns) * scale)),
        h: Math.max(1, Math.round((image.naturalHeight / SHEET.rows) * scale)),
      }
      const ink = getComputedStyle(canvas.parentElement ?? canvas).color
      const paper = getComputedStyle(canvas).color
      const key = `${next.w}x${next.h} ${ink} ${paper}`
      if (key !== castFor) {
        cell = next
        cast(sheet, image, cell, ink, paper)
        castFor = key
      }
      draw()
    }

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      stage = { w: canvas.clientWidth, h: canvas.clientHeight }
      canvas.width = Math.round(stage.w * ratio)
      canvas.height = Math.round(stage.h * ratio)
      const h = stage.h * HEIGHT
      size = { h, w: h * (image.naturalWidth / SHEET.columns / (image.naturalHeight / SHEET.rows)) }
      fill()
      paint()
    }

    let frame = 0
    let last = 0
    const tick = (now: number) => {
      const seconds = last ? Math.min((now - last) / 1000, 0.1) : 0
      last = now
      let left = false
      for (const [i, peep] of crowd.entries()) {
        peep.x += peep.direction * peep.speed * seconds
        peep.t += seconds * (peep.speed / size.h) * 2
        if (peep.direction === 1 ? peep.x > stage.w : peep.x < -size.w) {
          // Someone else from the sheet comes on, from either side.
          crowd[i] = enter(false)
          left = true
        }
      }
      if (left) crowd.sort(nearLast)
      draw()
      frame = requestAnimationFrame(tick)
    }
    const play = () => {
      if (still || frame) return
      last = 0
      frame = requestAnimationFrame(tick)
    }
    const pause = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }

    // The theme's colours ease in over a moment: paint at once, and again once settled.
    let settle = 0
    const theme = new MutationObserver(() => {
      requestAnimationFrame(paint)
      window.clearTimeout(settle)
      settle = window.setTimeout(paint, 600)
    })

    const sizes = new ResizeObserver(() => resize())
    const seen = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()))
    image.onload = () => {
      resize()
      canvas.dataset.ready = ''
      theme.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      })
      sizes.observe(canvas)
      seen.observe(canvas)
    }
    image.src = SHEET.src

    return () => {
      image.onload = null
      pause()
      sizes.disconnect()
      seen.disconnect()
      theme.disconnect()
      window.clearTimeout(settle)
      // Give iOS Safari its canvas memory back now, not when it collects.
      sheet.width = sheet.height = 0
    }
  }, [])

  return (
    <div aria-hidden className={styles.scene} data-scene="crowd">
      <canvas className={styles.crowd} ref={canvasRef} />
    </div>
  )
}
