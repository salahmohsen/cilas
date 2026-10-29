'use client'

// Adapted from https://www.interior.dev/docs/lightbox (Interior Lightbox).
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import styles from './lightbox.module.css'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react'

const MotionImage = motion.create(Image)

const CELL = {
  type: 'spring',
  stiffness: 520,
  damping: 34,
  mass: 0.45,
} as const

const HOME = {
  type: 'spring',
  stiffness: 150,
  damping: 27,
  mass: 1,
} as const

const VEIL = {
  type: 'spring',
  stiffness: 260,
  damping: 34,
  mass: 0.8,
} as const

const EASE = [0.23, 1, 0.32, 1] as const
const EXIT = { duration: 0.2, ease: [0.4, 0, 1, 1] } as const

const GLYPH = {
  type: 'spring',
  stiffness: 700,
  damping: 46,
  mass: 0.5,
} as const

const TOGGLE = 2.5
const KEY_ZOOM = 1.6
const KEY_PAN = 56
const WHEEL_RATE = 140
const SLOP = 8
const NEAR_HOME = 1.02
const SNAP_HOME = 1.05

type Spring = {
  type: 'spring'
  stiffness: number
  damping: number
  mass: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Drag = {
  id: number
  from: { x: number; y: number }
  x: number
  y: number
}

export type UseLightboxOptions = {
  maxScale?: number
  steps?: number
  disabled?: boolean
  onDismiss?: () => void
}

export function useLightbox<
  Frame extends HTMLElement = HTMLDivElement,
  Content extends HTMLElement = HTMLImageElement,
>({ maxScale = 4, steps = 8, disabled = false, onDismiss }: UseLightboxOptions = {}) {
  const cells = Math.max(1, Math.round(steps))
  const top = Math.max(1.1, maxScale)

  const frameRef = useRef<Frame>(null)
  const contentRef = useRef<Content>(null)

  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const [step, setStep] = useState(0)
  const [settled, setSettled] = useState(0)

  const stepRef = useRef(0)
  const settledRef = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const drag = useRef<Drag | null>(null)
  const onContent = useRef(false)

  const reduced = useReducedMotion()

  const toStep = useCallback(
    (s: number) => clamp(Math.round(((s - 1) / (top - 1)) * cells), 0, cells),
    [cells, top],
  )

  const mark = useCallback(
    (s: number) => {
      const next = toStep(s)
      if (stepRef.current === next) return
      stepRef.current = next
      setStep(next)
    },
    [toStep],
  )

  const settle = useCallback(
    (s: number) => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
      const next = toStep(s)
      if (settledRef.current === next) return
      settledRef.current = next
      setSettled(next)
    },
    [toStep],
  )

  const settleSoon = useCallback(
    (s: number) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        timer.current = null
        settle(s)
      }, 220)
    },
    [settle],
  )

  const limit = useCallback((s: number) => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return { mx: 0, my: 0 }
    return {
      mx: Math.max(0, (content.offsetWidth * s - frame.clientWidth) / 2),
      my: Math.max(0, (content.offsetHeight * s - frame.clientHeight) / 2),
    }
  }, [])

  const place = useCallback(
    (s: number, nx: number, ny: number) => {
      const { mx, my } = limit(s)
      scale.set(s)
      x.set(clamp(nx, -mx, mx))
      y.set(clamp(ny, -my, my))
      mark(s)
    },
    [limit, mark, scale, x, y],
  )

  const glide = useCallback(
    (s: number, nx: number, ny: number, spring: Spring = CELL) => {
      const { mx, my } = limit(s)
      const tx = clamp(nx, -mx, mx)
      const ty = clamp(ny, -my, my)
      if (reduced) {
        scale.set(s)
        x.set(tx)
        y.set(ty)
      } else {
        animate(scale, s, spring)
        animate(x, tx, spring)
        animate(y, ty, spring)
      }
      mark(s)
      settle(s)
    },
    [limit, mark, reduced, scale, settle, x, y],
  )

  const reset = useCallback(() => {
    glide(1, 0, 0, HOME)
  }, [glide])

  const zoomAt = useCallback(
    (next: number, cx: number, cy: number, animated: boolean) => {
      const frame = frameRef.current
      if (!frame) return
      const r = frame.getBoundingClientRect()
      const px = cx - (r.left + r.width / 2)
      const py = cy - (r.top + r.height / 2)
      const s0 = scale.get()
      const ax = (px - x.get()) / s0
      const ay = (py - y.get()) / s0
      const s = clamp(next, 1, top)
      const nx = px - ax * s
      const ny = py - ay * s
      if (animated) {
        glide(s, nx, ny, s <= 1 ? HOME : CELL)
        return
      }
      place(s, nx, ny)
      settleSoon(s)
    },
    [glide, place, scale, settleSoon, top, x, y],
  )

  const finish = useCallback(() => {
    const s0 = scale.get()
    if (s0 < SNAP_HOME) reset()
    else settle(s0)
  }, [reset, scale, settle])

  const release = (e: React.PointerEvent) => {
    const held = drag.current
    if (!held || held.id !== e.pointerId) return
    drag.current = null
    const moved = Math.hypot(e.clientX - held.from.x, e.clientY - held.from.y)
    if (moved < SLOP && !onContent.current && scale.get() <= NEAR_HOME) {
      onDismiss?.()
      return
    }
    finish()
  }

  const cancel = (e: React.PointerEvent) => {
    const held = drag.current
    if (!held || held.id !== e.pointerId) return
    drag.current = null
    finish()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const frame = frameRef.current
    if (!frame || disabled) return
    const r = frame.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const s0 = scale.get()

    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomAt(s0 * KEY_ZOOM, cx, cy, true)
      return
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomAt(s0 / KEY_ZOOM, cx, cy, true)
      return
    }
    if (e.key === '0') {
      e.preventDefault()
      reset()
      return
    }
    if (e.key === 'Escape' && s0 > NEAR_HOME) {
      e.preventDefault()
      e.stopPropagation()
      reset()
      return
    }
    if (s0 > NEAR_HOME && e.key.startsWith('Arrow')) {
      e.preventDefault()
      const dx = e.key === 'ArrowLeft' ? KEY_PAN : e.key === 'ArrowRight' ? -KEY_PAN : 0
      const dy = e.key === 'ArrowUp' ? KEY_PAN : e.key === 'ArrowDown' ? -KEY_PAN : 0
      glide(s0, x.get() + dx, y.get() + dy)
    }
  }

  const bind = {
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const content = contentRef.current
      onContent.current = content ? content.contains(e.target as Node) : false
      e.currentTarget.setPointerCapture?.(e.pointerId)
      drag.current = {
        id: e.pointerId,
        from: { x: e.clientX, y: e.clientY },
        x: x.get(),
        y: y.get(),
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const held = drag.current
      if (!held || held.id !== e.pointerId) return
      if (scale.get() <= 1) return
      place(scale.get(), held.x + (e.clientX - held.from.x), held.y + (e.clientY - held.from.y))
    },
    onPointerUp: release,
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onDoubleClick: (e: React.MouseEvent) => {
      if (disabled) return
      zoomAt(scale.get() > SNAP_HOME ? 1 : Math.min(TOGGLE, top), e.clientX, e.clientY, true)
    },
    onKeyDown,
  }

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onWheel = (e: WheelEvent) => {
      if (disabled) return
      e.preventDefault()
      zoomAt(scale.get() * Math.exp(-e.deltaY / WHEEL_RATE), e.clientX, e.clientY, false)
    }
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => frame.removeEventListener('wheel', onWheel)
  }, [disabled, scale, zoomAt])

  useEffect(() => {
    const bail = () => {
      drag.current = null
    }
    window.addEventListener('blur', bail)
    return () => {
      window.removeEventListener('blur', bail)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return {
    frameRef,
    contentRef,
    bind,
    scale,
    x,
    y,
    step,
    steps: cells,
    zoom: 1 + (step / cells) * (top - 1),
    settledZoom: 1 + (settled / cells) * (top - 1),
    zoomed: step > 0,
    reset,
    zoomAt,
  }
}

export type LightboxProps = {
  open: boolean
  onClose: () => void
  src: string
  alt: string
  originRef?: React.RefObject<HTMLElement | null>
  caption?: string
  width?: number
  height?: number
  maxScale?: number
  className?: string
  position?: string
  onPrevious?: () => void
  onNext?: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
}

type Landing = { dx: number; dy: number; s: number; o: number; r: number }

function Stage({
  onClose,
  src,
  alt,
  originRef,
  caption,
  width,
  height,
  maxScale = 4,
  className = '',
  position,
  onPrevious,
  onNext,
  returnFocusRef,
}: LightboxProps) {
  const t = useTranslations('Gallery')
  const reduced = useReducedMotion()
  const hasDimensions = Boolean(width && height)
  const [loadedImage, setLoadedImage] = useState<string | null>(null)
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const fx = useMotionValue(0)
  const fy = useMotionValue(0)
  const fs = useMotionValue(1)
  const fo = useMotionValue(0)
  const fr = useMotionValue(14)

  const { frameRef, contentRef, bind, scale, x, y, zoomed, settledZoom, reset, zoomAt } =
    useLightbox({ maxScale, onDismiss: onClose })

  const toggleZoom = useCallback(() => {
    const frame = frameRef.current
    if (!frame) return
    if (zoomed) {
      reset()
      return
    }
    const r = frame.getBoundingClientRect()
    zoomAt(
      Math.min(TOGGLE, Math.max(1.1, maxScale)),
      r.left + r.width / 2,
      r.top + r.height / 2,
      true,
    )
  }, [frameRef, maxScale, reset, zoomAt, zoomed])

  const landing = useCallback((): Landing => {
    const frame = frameRef.current
    const content = contentRef.current
    const origin = originRef?.current
    if (hasDimensions && frame && content && origin && content.offsetWidth > 0) {
      const r = frame.getBoundingClientRect()
      const o = origin.getBoundingClientRect()
      if (o.width > 0) {
        const s = o.width / content.offsetWidth
        const rad = Number.parseFloat(getComputedStyle(origin).borderTopLeftRadius) || 9
        return {
          dx: o.left + o.width / 2 - (r.left + r.width / 2),
          dy: o.top + o.height / 2 - (r.top + r.height / 2),
          s,
          o: 1,
          r: rad / s,
        }
      }
    }
    return { dx: 0, dy: 10, s: 0.97, o: 0, r: 14 }
  }, [contentRef, frameRef, originRef, hasDimensions])

  useLayoutEffect(() => {
    if (reduced) {
      fx.set(0)
      fy.set(0)
      fs.set(1)
      fo.set(1)
      fr.set(14)
      return
    }
    const d = landing()
    fx.set(d.dx)
    fy.set(d.dy)
    fs.set(d.s)
    fo.set(d.o)
    fr.set(d.r)

    const runs = [
      animate(fx, 0, HOME),
      animate(fy, 0, HOME),
      animate(fs, 1, HOME),
      animate(fo, 1, HOME),
      animate(fr, 14, HOME),
    ]
    return () => runs.forEach((r) => r.stop())
  }, [fo, fr, fs, fx, fy, landing, reduced])

  const away = useCallback(() => {
    if (reduced) return { opacity: 0, transition: { duration: 0.12 } }
    const d = landing()
    animate(fr, d.r, HOME)
    return {
      x: d.dx,
      y: d.dy,
      scale: d.s,
      opacity: d.o,
      transition: HOME,
    }
  }, [fr, landing, reduced])

  const unwind = useCallback(
    () => ({
      x: 0,
      y: 0,
      scale: 1,
      transition: reduced ? { duration: 0 } : HOME,
    }),
    [reduced],
  )

  useLayoutEffect(() => {
    scale.set(1)
    x.set(0)
    y.set(0)
    reset()
  }, [src, scale, x, y, reset])

  return (
    <>
      <DialogPrimitive.Overlay forceMount asChild>
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: reduced ? { duration: 0 } : { duration: 0.3, ease: EASE },
          }}
          transition={reduced ? { duration: 0 } : VEIL}
          className={styles.backdrop}
        />
      </DialogPrimitive.Overlay>
      <DialogPrimitive.Content
        forceMount
        asChild
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          frameRef.current?.focus({ preventScroll: true })
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef?.current?.focus({ preventScroll: true })
        }}
        onEscapeKeyDown={(event) => {
          if (scale.get() > NEAR_HOME) {
            event.preventDefault()
            reset()
          }
        }}
        onKeyDown={(event) => {
          if (event.defaultPrevented || scale.get() > NEAR_HOME) return
          if (event.key === 'ArrowLeft' && onPrevious) {
            event.preventDefault()
            onPrevious()
          }
          if (event.key === 'ArrowRight' && onNext) {
            event.preventDefault()
            onNext()
          }
        }}
      >
        <div className={`${styles.shell} ${className}`}>
          <div
            ref={frameRef}
            tabIndex={-1}
            role="group"
            aria-label={caption ?? alt}
            style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
            className={styles.frame}
            data-zoomed={zoomed}
            {...bind}
          >
            <motion.div
              style={{ x: fx, y: fy, scale: fs, opacity: fo }}
              variants={{ away }}
              exit="away"
              className={styles.stage}
            >
              <div className={hasDimensions ? styles.imageBox : styles.imageFallback}>
                <MotionImage
                  key={`${src}-${attempt}`}
                  ref={contentRef}
                  src={src}
                  alt={alt}
                  {...(hasDimensions ? { width, height } : { fill: true })}
                  sizes={zoomed ? `${maxScale * 100}vw` : '100vw'}
                  loading="eager"
                  draggable={false}
                  style={{ x, y, scale, borderRadius: fr }}
                  variants={{ away: unwind }}
                  exit="away"
                  className={styles.image}
                  data-failed={failedImage === src}
                  onLoad={() => setLoadedImage(src)}
                  onError={() => setFailedImage(src)}
                />
              </div>
              {failedImage === src ? (
                <div
                  className={styles.message}
                  role="alert"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <p>{t('loadError')}</p>
                  <button
                    type="button"
                    className={styles.retry}
                    onClick={() => {
                      setFailedImage(null)
                      setLoadedImage(null)
                      setAttempt((value) => value + 1)
                    }}
                  >
                    {t('retry')}
                  </button>
                </div>
              ) : loadedImage !== src ? (
                <p className={styles.message} role="status">
                  {t('loading')}
                </p>
              ) : null}
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: reduced ? { duration: 0 } : EXIT }}
            transition={reduced ? { duration: 0 } : VEIL}
            className={styles.toolbar}
          >
            <DialogPrimitive.Title className={styles.caption} dir="auto">
              {caption ?? alt}
              {position && <span className={styles.position}>{position}</span>}
            </DialogPrimitive.Title>
            <div className={styles.controls}>
              {onPrevious && onNext && (
                <>
                  <button
                    type="button"
                    onClick={onPrevious}
                    aria-label={t('previous')}
                    className={styles.control}
                  >
                    <ArrowLeft size={20} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={onNext}
                    aria-label={t('next')}
                    className={styles.control}
                  >
                    <ArrowRight size={20} aria-hidden />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={toggleZoom}
                aria-label={zoomed ? t('zoomOut') : t('zoomIn')}
                className={styles.control}
              >
                <svg
                  viewBox="0 0 256 256"
                  width={20}
                  height={20}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="116" cy="116" r="84" />
                  <path d="M175.4 175.4 224 224M84 116h64" />
                  <motion.path
                    d="M116 84v64"
                    initial={false}
                    animate={{ opacity: zoomed ? 0 : 1 }}
                    transition={reduced ? { duration: 0 } : GLYPH}
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('close')}
                className={styles.control}
              >
                <svg
                  viewBox="0 0 256 256"
                  width={20}
                  height={20}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M200 56 56 200M200 200 56 56" />
                </svg>
              </button>
            </div>
          </motion.div>
          <DialogPrimitive.Description className="sr-only">{t('hint')}</DialogPrimitive.Description>
          <p role="status" className="sr-only">
            {position}. {alt}. {t('zoomStatus', { zoom: settledZoom.toFixed(1) })}
          </p>
        </div>
      </DialogPrimitive.Content>
    </>
  )
}

export function Lightbox(props: LightboxProps) {
  return (
    <DialogPrimitive.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DialogPrimitive.Portal forceMount>
        <AnimatePresence>{props.open ? <Stage key="lightbox" {...props} /> : null}</AnimatePresence>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
