'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { useTranslations } from 'next-intl'
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/arc/button/button'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import {
  MAX_ZOOM,
  clampOffset,
  clampZoom,
  cropRect,
  dragAxis,
  offsetLimit,
  shownSize,
  zoomAt,
  type Offset,
  type Size,
} from '@/lib/image-crop'

import styles from './image-upload.module.css'

export type CropResult = { x: number; y: number; width: number; height: number }

type Props = {
  /** The picked photo, shown in the stage. */
  src: string
  /** Its natural size, upright. */
  image: Size
  /** The crop window, in pixels. */
  frame: Size
  shape: 'circle' | 'rect'
  /** Shared with the control the frame grows from, so it morphs in place. */
  layoutId?: string
  /** The confirm button's words. */
  saveLabel: string
  onSave: (crop: CropResult) => void
  onCancel: () => void
}

const KEY_STEP = 0.02
const KEY_STEP_LARGE = 0.1
const ZOOM_STEP = 0.25
const ENTER = [...motionTokens.ease.enter] as [number, number, number, number]

const usePhotoTransform = (
  x: MotionValue<number>,
  y: MotionValue<number>,
  z: MotionValue<number>,
) =>
  useTransform(
    [x, y, z] as MotionValue<number>[],
    ([ox, oy, zoom]: number[]) =>
      `translate(${-50 + ox! * zoom! * 100}%, ${-50 + oy! * zoom! * 100}%) scale(${zoom})`,
  )

/**
 * The crop step: the photo under a circle or rectangle on a tinted stage, the
 * part outside the frame dimmed. Drag to move, wheel or pinch to zoom toward
 * the pointer, or use the keys and the slider. Both copies of the photo move
 * with one transform each, in percentages of their own size.
 */
export function Cropper({
  src,
  image,
  frame,
  shape,
  layoutId,
  saveLabel,
  onSave,
  onCancel,
}: Props) {
  const t = useTranslations('ImageUpload')
  const reduce = !!useReducedMotion()
  const stage = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const z = useMotionValue(1)
  const [zoom, setZoomState] = useState(1)
  const [active, setActive] = useState(false)
  const transform = usePhotoTransform(x, y, z)
  const base = shownSize(image, frame, 1)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{
    start: Offset
    zoom: number
    from: { x: number; y: number }
    distance: number
  } | null>(null)

  useEffect(() => {
    stage.current?.focus({ preventScroll: true })
  }, [])

  const offset = (): Offset => ({ x: x.get(), y: y.get() })
  const place = (next: Offset, nextZoom: number, smooth = false) => {
    const settle = (value: MotionValue<number>, to: number) => {
      if (smooth && !reduce) return void animate(value, to, motionTokens.spring.smooth)
      value.stop()
      value.set(to)
    }
    settle(x, next.x)
    settle(y, next.y)
    settle(z, nextZoom)
    setZoomState(nextZoom)
  }
  const zoomTo = (next: number, point?: Offset, smooth = false) => {
    const target = clampZoom(next)
    place(zoomAt(offset(), image, frame, z.get(), target, point), target, smooth)
  }

  /** The pointer's place from the frame's centre, in pixels. */
  const fromCentre = (clientX: number, clientY: number): Offset => {
    const box = stage.current!.getBoundingClientRect()
    return { x: clientX - box.left - box.width / 2, y: clientY - box.top - box.height / 2 }
  }

  // React's wheel listener is passive; the stage must keep the page from scrolling.
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      // A trackpad pinch arrives as a wheel with ctrlKey and small steps.
      const rate = event.ctrlKey ? 0.01 : 0.002
      const box = node.getBoundingClientRect()
      zoomTo(z.get() * Math.exp(-event.deltaY * rate), {
        x: event.clientX - box.left - box.width / 2,
        y: event.clientY - box.top - box.height / 2,
      })
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  })

  const begin = () => {
    const list = [...pointers.current.values()]
    const [a, b] = list
    gesture.current = {
      start: offset(),
      zoom: z.get(),
      from: b ? { x: (a!.x + b.x) / 2, y: (a!.y + b.y) / 2 } : a!,
      distance: b ? Math.hypot(a!.x - b.x, a!.y - b.y) : 0,
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || pointers.current.size >= 2) return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    x.stop()
    y.stop()
    begin()
    setActive(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const g = gesture.current
    const [a, b] = [...pointers.current.values()]
    if (b) {
      const mid = { x: (a!.x + b.x) / 2, y: (a!.y + b.y) / 2 }
      const next = clampZoom((g.zoom * Math.hypot(a!.x - b.x, a!.y - b.y)) / (g.distance || 1))
      const moved = zoomAt(g.start, image, frame, g.zoom, next, fromCentre(mid.x, mid.y))
      const shown = shownSize(image, frame, next)
      place(
        clampOffset(
          {
            x: moved.x + (mid.x - g.from.x) / shown.width,
            y: moved.y + (mid.y - g.from.y) / shown.height,
          },
          image,
          frame,
          next,
        ),
        next,
      )
      return
    }
    const current = z.get()
    const shown = shownSize(image, frame, current)
    const limit = offsetLimit(image, frame, current)
    const max = Math.min(frame.width, frame.height) / 4
    x.set(dragAxis(g.start.x + (a!.x - g.from.x) / shown.width, limit.x, shown.width, max))
    y.set(dragAxis(g.start.y + (a!.y - g.from.y) / shown.height, limit.y, shown.height, max))
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return
    if (pointers.current.size) return begin()
    gesture.current = null
    setActive(false)
    place(clampOffset(offset(), image, frame, z.get()), z.get(), true)
  }

  const save = () => {
    const now = z.get()
    onSave(cropRect(image, frame, now, clampOffset(offset(), image, frame, now)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = (event.shiftKey ? KEY_STEP_LARGE : KEY_STEP) * Math.min(frame.width, frame.height)
    const shown = shownSize(image, frame, z.get())
    // Arrow keys move the photo the way they point, whatever the page's direction.
    const move: Record<string, Offset> = {
      ArrowLeft: { x: -step / shown.width, y: 0 },
      ArrowRight: { x: step / shown.width, y: 0 },
      ArrowUp: { x: 0, y: -step / shown.height },
      ArrowDown: { x: 0, y: step / shown.height },
    }
    const by = move[event.key]
    if (by) {
      event.preventDefault()
      const now = offset()
      place(clampOffset({ x: now.x + by.x, y: now.y + by.y }, image, frame, z.get()), z.get(), true)
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomTo(z.get() + ZOOM_STEP, undefined, true)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomTo(z.get() - ZOOM_STEP, undefined, true)
    } else if (event.key === '0') {
      event.preventDefault()
      place({ x: 0, y: 0 }, 1, true)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  const percent = Math.round(zoom * 100)
  const photo = { width: base.width, height: base.height, transform }
  const fade = reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: ENTER }

  return (
    <div className={styles.cropper} data-shape={shape}>
      <motion.div
        ref={stage}
        className={styles.stage}
        style={{ padding: shape === 'circle' ? 32 : 20 }}
        role="group"
        aria-roledescription={t('cropRole')}
        aria-label={t('cropArea', { percent })}
        tabIndex={0}
        data-active={active || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <motion.span
          className={styles.tint}
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={fade}
        />
        <div className={styles.stageInner} style={{ width: frame.width, height: frame.height }}>
          <motion.img
            className={styles.overflow}
            src={src}
            alt=""
            draggable={false}
            style={photo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={fade}
          />
          {/* The dim over the photo outside the frame lifts while the photo moves. */}
          <motion.span
            className={styles.dim}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: active ? 0.55 : 1 }}
            transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.fast }}
          />
          <motion.div
            layoutId={layoutId}
            className={styles.frame}
            style={{
              width: frame.width,
              height: frame.height,
              borderRadius: shape === 'circle' ? 9999 : 'var(--radius-control)',
            }}
            transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
          >
            <motion.img
              className={styles.inside}
              src={src}
              alt=""
              draggable={false}
              style={photo}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fade}
            />
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className={styles.controls}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={fade}
      >
        <div className={styles.copy}>
          <p className={styles.title}>{t('adjust')}</p>
          <p className={styles.message}>{t('adjustHint')}</p>
        </div>
        <div className={styles.zoom}>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label={t('zoomOut')}
            disabled={zoom <= 1}
            onClick={() => zoomTo(z.get() - ZOOM_STEP, undefined, true)}
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <input
            type="range"
            className={styles.range}
            aria-label={t('zoom')}
            aria-valuetext={t('percent', { percent })}
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            style={{ '--fill': `${((zoom - 1) / (MAX_ZOOM - 1)) * 100}%` } as CSSProperties}
            onPointerDown={() => setActive(true)}
            onPointerUp={() => setActive(false)}
            onChange={(event) => zoomTo(Number(event.currentTarget.value))}
          />
          <button
            type="button"
            className={styles.zoomButton}
            aria-label={t('zoomIn')}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomTo(z.get() + ZOOM_STEP, undefined, true)}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.actions}>
          <Button type="button" size="sm" onClick={save}>
            {saveLabel}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
