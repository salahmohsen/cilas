'use client'

/**
 * Componentry's Wheel Carousel (componentry.dev/docs/components/wheel-carousel),
 * adapted: colours come from the site's tokens (so it follows the site's own
 * theme toggle), motion from `motion/react` (already a dependency), the arc
 * mirrors in right-to-left pages, an item without a photo shows its
 * initials, and the screen-reader text is passed in for each language.
 */

import { cn } from '@/lib/utils'
import { AvatarImage } from '@/components/person/avatar-image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'

export interface WheelCarouselItem {
  label: string
  /** Omit when there is no photo: the panel then shows the label's initials. */
  image?: string
  imageAlt?: string
  fallbackSeed?: string
}

export interface WheelCarouselProps {
  items: WheelCarouselItem[]
  /** Names the list for screen readers. */
  label: string
  /** "Name, 3 of 40", for screen readers. */
  announce: (item: WheelCarouselItem, index: number, count: number) => string
  /** Mirrors the wheel: the arc opens toward the start of the line. */
  dir?: 'ltr' | 'rtl'
  photoSide?: 'left' | 'right'
  photoWidth?: number
  photoAspect?: '3/4' | '1/1' | '4/3' | '3/2'
  contentWidth?: number
  gap?: number
  photoRadius?: number
  crossfadeDuration?: number
  radius?: number
  spacing?: number
  visibleItems?: number
  apexInset?: number
  showMarker?: boolean
  markerSize?: number
  markerGap?: number
  scrollSpeed?: number
  dragSpeed?: number
  snap?: boolean
  momentum?: boolean
  appear?: boolean
  edgeFade?: boolean
  edgeFadeSize?: number
  initialIndex?: number
  activeIndex?: number
  onActiveChange?: (item: WheelCarouselItem, index: number) => void
  className?: string
  photoClassName?: string
  itemClassName?: string
}

const aspectRatios = {
  '3/4': '3 / 4',
  '1/1': '1 / 1',
  '4/3': '4 / 3',
  '3/2': '3 / 2',
} as const

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length
}

function shortestOffset(index: number, rotation: number, length: number) {
  let offset = index - rotation
  while (offset > length / 2) offset -= length
  while (offset < -length / 2) offset += length
  return offset
}

export function WheelCarousel({
  items,
  label,
  announce,
  dir = 'ltr',
  photoSide = 'left',
  photoWidth = 24,
  photoAspect = '3/4',
  contentWidth = 900,
  gap = 0,
  photoRadius = 14,
  crossfadeDuration = 0.5,
  radius = 320,
  spacing = 14,
  visibleItems = 7,
  apexInset = 34,
  showMarker = true,
  markerSize = 16,
  markerGap = 20,
  scrollSpeed = 0.008,
  dragSpeed = 0.02,
  snap = true,
  momentum = true,
  appear = true,
  edgeFade = true,
  edgeFadeSize = 30,
  initialIndex = 0,
  activeIndex,
  onActiveChange,
  className,
  photoClassName,
  itemClassName,
}: WheelCarouselProps) {
  const reduceMotion = useReducedMotion() ?? false
  const instanceId = useId()
  const carouselItems = items
  // In RTL the names hang from the right and curve the other way.
  const side = dir === 'rtl' ? -1 : 1
  const itemCount = carouselItems.length
  const startingIndex = wrapIndex(activeIndex ?? initialIndex, itemCount)
  const [rotation, setRotation] = useState(startingIndex)
  const [selectedIndex, setSelectedIndex] = useState(startingIndex)
  const [isDragging, setIsDragging] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(startingIndex)
  const selectedRef = useRef(startingIndex)
  const appliedActiveIndexRef = useRef<number | null>(null)
  const velocityRef = useRef(0)
  const draggingRef = useRef(false)
  const dragOriginRef = useRef({ y: 0, rotation: startingIndex })
  const previousDragRotationRef = useRef(startingIndex)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const normalizedIndex = wrapIndex(selectedRef.current, itemCount)

    if (normalizedIndex === selectedRef.current) return

    selectedRef.current = normalizedIndex
    rotationRef.current = normalizedIndex
    setSelectedIndex(normalizedIndex)
    setRotation(normalizedIndex)
  }, [itemCount])

  // The site's tokens, so light and dark follow the site's own theme.
  const palette = {
    background: 'var(--background)',
    text: 'var(--text-muted)',
    selected: 'var(--foreground)',
    marker: 'var(--foreground)',
    panel: 'var(--surface-muted, var(--muted))',
  }

  const commitRotation = useCallback(
    (nextRotation: number) => {
      rotationRef.current = nextRotation
      setRotation(nextRotation)
      const nextIndex = wrapIndex(Math.round(nextRotation), itemCount)
      if (nextIndex !== selectedRef.current) {
        selectedRef.current = nextIndex
        setSelectedIndex(nextIndex)
        onActiveChange?.(carouselItems[nextIndex]!, nextIndex)
      }
    },
    [carouselItems, itemCount, onActiveChange],
  )

  const commitRotationRef = useRef(commitRotation)
  useEffect(() => {
    commitRotationRef.current = commitRotation
  }, [commitRotation])

  const runAnimation = useCallback(() => {
    if (frameRef.current !== null) return

    const tick = () => {
      let keepAnimating = false

      if (!draggingRef.current && Math.abs(velocityRef.current) > 0.0008) {
        commitRotation(rotationRef.current + velocityRef.current)
        velocityRef.current *= momentum && !reduceMotion ? (snap ? 0.9 : 0.94) : 0.8
        keepAnimating = true
      } else if (!draggingRef.current && snap) {
        velocityRef.current = 0
        const target = Math.round(rotationRef.current)
        const delta = target - rotationRef.current
        if (Math.abs(delta) > 0.001 && !reduceMotion) {
          commitRotation(rotationRef.current + delta * 0.22)
          keepAnimating = true
        } else {
          commitRotation(target)
        }
      } else if (!draggingRef.current) {
        velocityRef.current = 0
      }

      if (keepAnimating) frameRef.current = requestAnimationFrame(tick)
      else frameRef.current = null
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [commitRotation, momentum, reduceMotion, snap])

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return // don't hijack pinch-zoom
      event.preventDefault()
      const delta = event.deltaY * scrollSpeed
      commitRotation(rotationRef.current + delta)
      velocityRef.current = delta * 0.2
      runAnimation()
    }

    stage.addEventListener('wheel', handleWheel, { passive: false })
    return () => stage.removeEventListener('wheel', handleWheel)
  }, [commitRotation, runAnimation, scrollSpeed])

  useEffect(() => {
    if (activeIndex === undefined) return
    const controlledIndex = wrapIndex(activeIndex, itemCount)
    if (appliedActiveIndexRef.current === controlledIndex) return
    appliedActiveIndexRef.current = controlledIndex
    const currentIndex = wrapIndex(Math.round(rotationRef.current), itemCount)
    let delta = controlledIndex - currentIndex
    if (delta > itemCount / 2) delta -= itemCount
    if (delta < -itemCount / 2) delta += itemCount
    selectedRef.current = controlledIndex
    setSelectedIndex(controlledIndex)
    commitRotationRef.current(rotationRef.current + delta)
  }, [activeIndex, itemCount])

  const moveBy = (amount: number) => {
    velocityRef.current = 0
    commitRotation(rotationRef.current + amount)
    runAnimation()
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    draggingRef.current = true
    setIsDragging(true)
    velocityRef.current = 0
    dragOriginRef.current = { y: event.clientY, rotation: rotationRef.current }
    previousDragRotationRef.current = rotationRef.current
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const distance = event.clientY - dragOriginRef.current.y
    const nextRotation = dragOriginRef.current.rotation - distance * dragSpeed
    velocityRef.current = nextRotation - previousDragRotationRef.current
    previousDragRotationRef.current = nextRotation
    commitRotation(nextRotation)
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    runAnimation()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
    const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    if (event.key === 'ArrowDown' || event.key === forward) {
      event.preventDefault()
      moveBy(1)
    }
    if (event.key === 'ArrowUp' || event.key === back) {
      event.preventDefault()
      moveBy(-1)
    }
    if (event.key === 'Home') {
      event.preventDefault()
      velocityRef.current = 0
      commitRotation(rotationRef.current - selectedIndex)
      runAnimation()
    }
    if (event.key === 'End') {
      event.preventDefault()
      velocityRef.current = 0
      const lastIndex = itemCount - 1
      commitRotation(rotationRef.current + lastIndex - selectedIndex)
      runAnimation()
    }
  }

  const safeSelectedIndex = wrapIndex(selectedIndex, itemCount)
  const selectedItem = carouselItems[safeSelectedIndex]!
  const mask = edgeFade
    ? `linear-gradient(to bottom, transparent 0%, black ${edgeFadeSize}%, black ${100 - edgeFadeSize}%, transparent 100%)`
    : undefined

  return (
    <motion.div
      initial={appear && !reduceMotion ? { opacity: 0, y: 18 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden',
        className,
      )}
      style={{ backgroundColor: palette.background }}
    >
      <div
        ref={stageRef}
        role="listbox"
        aria-label={label}
        aria-activedescendant={
          Math.abs(shortestOffset(safeSelectedIndex, rotation, itemCount)) <= visibleItems + 1
            ? `${instanceId}-item-${safeSelectedIndex}`
            : undefined
        }
        tabIndex={0}
        className={cn(
          'flex h-full w-full touch-none select-none items-stretch overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current',
          photoSide === 'right' && 'flex-row-reverse',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        style={{ maxWidth: contentWidth, gap }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
      >
        <div
          className="flex h-full shrink-0 items-center justify-center"
          style={{
            width: `${photoWidth}%`,
            backgroundColor: palette.background,
          }}
        >
          <div
            className={cn('relative w-full max-h-full overflow-hidden', photoClassName)}
            style={{
              aspectRatio: aspectRatios[photoAspect],
              borderRadius: photoRadius,
              backgroundColor: palette.panel,
            }}
          >
            <AnimatePresence initial={false} mode="sync">
              {selectedItem.image || selectedItem.fallbackSeed ? (
                <motion.div
                  key={`${safeSelectedIndex}-${selectedItem.image ?? selectedItem.fallbackSeed}`}
                  initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : crossfadeDuration }}
                  className="absolute inset-0 h-full w-full object-cover"
                >
                  <AvatarImage
                    src={selectedItem.image}
                    fallbackSeed={selectedItem.fallbackSeed ?? selectedItem.label}
                    alt={selectedItem.imageAlt ?? selectedItem.label}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </motion.div>
              ) : (
                <motion.span
                  key={`${safeSelectedIndex}-initials`}
                  aria-hidden="true"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : crossfadeDuration }}
                  className="absolute inset-0 grid place-items-center font-heading text-6xl text-[var(--text-muted)]"
                >
                  {/\p{Script=Arabic}/u.test(selectedItem.label)
                    ? selectedItem.label.at(0) // Arabic has no initials; the first letter stands for the name.
                    : selectedItem.label
                        .split(/\s+/)
                        .map((part) => part.at(0))
                        .join('')
                        .slice(0, 2)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div
          className="relative h-full min-w-0 flex-1 overflow-hidden"
          style={{ maskImage: mask, WebkitMaskImage: mask }}
        >
          {showMarker && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full"
              style={{
                insetInlineStart: `calc(${apexInset}% - ${markerGap}px)`,
                width: markerSize,
                height: markerSize,
                marginInlineStart: -markerSize,
                backgroundColor: palette.marker,
              }}
            />
          )}

          {carouselItems.map((item, index) => {
            const offset = shortestOffset(index, rotation, itemCount)
            if (Math.abs(offset) > visibleItems + 1) return null

            const angle = offset * spacing
            const radians = (angle * Math.PI) / 180
            const x = -radius * (1 - Math.cos(radians)) * side
            const y = radius * Math.sin(radians)
            const distance = Math.min(Math.abs(offset) / visibleItems, 1)
            const opacity = Math.cos((distance * Math.PI) / 2)
            const scale = 1 - Math.min(Math.abs(offset) * 0.04, 0.45)
            const selected = Math.abs(offset) < 0.5

            return (
              <div
                id={`${instanceId}-item-${index}`}
                key={`${item.label}-${index}`}
                role="option"
                aria-selected={selected}
                className={cn(
                  'pointer-events-none absolute top-1/2 origin-left whitespace-nowrap rtl:origin-right text-[clamp(1rem,2.4vw,1.625rem)] font-medium leading-none tracking-[-0.01em]',
                  itemClassName,
                )}
                style={{
                  insetInlineStart: `${apexInset}%`,
                  color: selected ? palette.selected : palette.text,
                  opacity,
                  transform: `translate(${x}px, ${y}px) translateY(-50%) rotate(${angle * side}deg) scale(${scale})`,
                }}
              >
                {item.label}
              </div>
            )
          })}
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {announce(selectedItem, safeSelectedIndex, itemCount)}
      </span>
    </motion.div>
  )
}
