'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import type { SpaceFileRef } from '@/lib/spaces-data'

import styles from './photo-grid.module.css'

/** The grid never shows more tiles than this; the last one counts the rest. */
const TILES = 4
/** How far a swipe travels, in px, before it moves to the next photo. */
const SWIPE = 60

const fade = { duration: motionTokens.duration.instant }

/** The new photo slides in from the side it came from; reduced motion only fades. */
const slide = (reduced: boolean) => ({
  enter: (from: number) => (reduced ? { opacity: 0 } : { opacity: 0, x: from, scale: 0.98 }),
  center: { opacity: 1, x: 0, scale: 1, transition: reduced ? fade : motionTokens.spring.smooth },
  exit: (from: number) => ({ opacity: 0, x: reduced ? 0 : -from, transition: fade }),
})

/** A lone photo keeps its shape, within bounds that keep a feed card readable. */
const singleRatio = (p: SpaceFileRef) =>
  p.width && p.height ? Math.min(16 / 9, Math.max(4 / 5, p.width / p.height)) : 4 / 3

/**
 * The images of a post or comment (ADR 0008 files, served through Payload's
 * read rule): one fills the width, two sit side by side, three put one large
 * beside two, and four or more show four tiles, the last blurred with the
 * count of the rest. Any tile opens every image in a lightbox.
 */
export function PhotoGrid({
  photos,
  compact = false,
}: {
  photos: SpaceFileRef[]
  /** In a comment: a smaller grid under the text */
  compact?: boolean
}) {
  const t = useTranslations('SpacePhotos')
  const reduced = useReducedMotion()
  const [open, setOpen] = useState<number | null>(null)
  if (!photos.length) return null
  const tiles = photos.slice(0, TILES)
  const rest = photos.length - TILES

  return (
    <>
      <ul
        className={styles.grid}
        data-count={Math.min(photos.length, TILES)}
        data-compact={compact || undefined}
        aria-label={t('photos')}
        style={photos.length === 1 ? { aspectRatio: singleRatio(photos[0]) } : undefined}
      >
        {tiles.map((p, index) => {
          const more = index === TILES - 1 && rest > 0
          return (
            <li key={p.id} className={styles.cell}>
              <motion.button
                type="button"
                className={styles.tile}
                aria-label={
                  more
                    ? `${t('open', { name: p.name })}, ${t('more', { count: rest })}`
                    : t('open', { name: p.name })
                }
                onClick={() => setOpen(index)}
                whileTap={reduced ? undefined : { scale: 0.97 }}
                transition={motionTokens.spring.snappy}
              >
                {/* Private files come from Payload's own route, which next/image cannot read with the member's session. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.name}
                  loading="lazy"
                  decoding="async"
                  className={more ? `${styles.image} ${styles.blurred}` : styles.image}
                />
                {more && (
                  <span className={styles.more} aria-hidden="true" dir="ltr">
                    +{rest}
                  </span>
                )}
              </motion.button>
            </li>
          )
        })}
      </ul>
      <Lightbox photos={photos} index={open} onIndexChange={setOpen} />
    </>
  )
}

function Lightbox({
  photos,
  index,
  onIndexChange,
}: {
  photos: SpaceFileRef[]
  index: number | null
  onIndexChange: (index: number | null) => void
}) {
  const t = useTranslations('SpacePhotos')
  const rtl = useLocale() === 'ar'
  const reduced = useReducedMotion()
  // Which way the last move went, so the new photo enters from that side.
  const [step, setStep] = useState(0)
  const [shown, setShown] = useState(index ?? 0)
  if (index != null && index !== shown) setShown(index)
  const current = photos[shown] ?? photos[0]
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (index == null) return
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [index, reduced])

  const go = (to: number) => {
    const next = (to + photos.length) % photos.length
    setStep(Math.sign(to - shown))
    onIndexChange(next)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    // Arrows follow the reading direction: the left arrow goes forward in Arabic.
    const forward = (event.key === 'ArrowRight') !== rtl
    go(shown + (forward ? 1 : -1))
  }
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE) return
    const forward = info.offset.x < 0 !== rtl
    go(shown + (forward ? 1 : -1))
  }
  const many = photos.length > 1
  const Back = rtl ? ArrowRight : ArrowLeft
  const Prev = rtl ? ChevronRight : ChevronLeft
  const Next = rtl ? ChevronLeft : ChevronRight
  // Physical offsets: in Arabic the next photo sits to the left.
  const from = (rtl ? -step : step) * 40

  return (
    <Dialog open={index != null} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogContent
        title={current.name}
        description={t('position', { index: shown + 1, total: photos.length })}
        className={styles.lightbox}
        onKeyDown={onKeyDown}
      >
        <DialogClose className={styles.back} aria-label={t('close')}>
          <Back size={18} strokeWidth={1.75} aria-hidden="true" />
        </DialogClose>
        <div className={styles.stage}>
          {many && (
            <button
              type="button"
              className={`${styles.nav} ${styles.prev}`}
              aria-label={t('previous')}
              onClick={() => go(shown - 1)}
            >
              <Prev size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <div className={styles.frame}>
            <AnimatePresence initial={false} mode="popLayout" custom={from}>
              <motion.img
                key={current.id}
                src={current.url}
                alt={current.name}
                className={styles.full}
                draggable={false}
                drag={many ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                dragSnapToOrigin
                onDragEnd={onDragEnd}
                custom={from}
                variants={slide(!!reduced)}
                initial="enter"
                animate="center"
                exit="exit"
              />
            </AnimatePresence>
          </div>
          {many && (
            <button
              type="button"
              className={`${styles.nav} ${styles.next}`}
              aria-label={t('next')}
              onClick={() => go(shown + 1)}
            >
              <Next size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>
        {many && (
          <div ref={strip} className={styles.strip} role="group" aria-label={t('strip')}>
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={styles.thumb}
                aria-label={t('show', { name: p.name })}
                aria-current={i === shown}
                onClick={() => go(i)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
