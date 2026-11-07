'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { motion, useAnimate, useReducedMotion } from 'motion/react'
import { arc } from 'motion'
import { cn } from '@/lib/utils'

// A fixed 6px dot (the original rounded it to the pixel ratio via state in an effect).
const DOT_SIZE = 6

const MotionLink = motion.create(Link)

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

type BounceSidebarItem =
  | string
  | { label: string; href?: string }
  | { label: string; heading: true }

type BounceSidebarProps = Omit<ComponentProps<'ul'>, 'onChange'> & {
  items: BounceSidebarItem[]
  value?: number
  defaultValue?: number
  onChange?: (index: number) => void
  dotColor?: string
}

export function BounceSidebar({
  items,
  value,
  defaultValue = 0,
  onChange,
  dotColor = 'var(--foreground)',
  className,
  ...props
}: BounceSidebarProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const activeIndex = value ?? internalValue

  const [dot, animate] = useAnimate<HTMLSpanElement>()
  // Reduced motion: the dot moves without travelling.
  const reduced = useReducedMotion()
  const itemRefs = useRef<(HTMLLIElement | null)[]>([])
  const prevY = useRef<number | null>(null)

  const [ready, setReady] = useState(false)

  useIsomorphicLayoutEffect(() => {
    let cancelled = false
    const snap = () => {
      const el = itemRefs.current[activeIndex]
      if (cancelled || !el || !dot.current) return
      const dpr = window.devicePixelRatio || 1
      const size = Math.round(6 * dpr) / dpr
      const toY = Math.round((el.offsetTop + el.offsetHeight / 2 - size / 2) * dpr) / dpr
      animate(dot.current, { x: 0, y: toY }, { duration: 0 })
      prevY.current = toY
      setReady(true)
    }

    snap()
    const raf = requestAnimationFrame(snap)
    document.fonts?.ready.then(snap)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (!el || !dot.current) return

    const dpr = window.devicePixelRatio || 1
    const toY = Math.round((el.offsetTop + el.offsetHeight / 2 - DOT_SIZE / 2) * dpr) / dpr

    if (prevY.current === null) {
      animate(dot.current, { x: 0, y: toY }, { duration: 0 })
      prevY.current = toY
      return
    }

    const fromY = prevY.current
    const delta = toY - fromY
    prevY.current = toY
    if (delta === 0) return

    const distance = Math.abs(delta)
    const path = arc({
      strength: Math.min(0.8, 14 / distance),
      direction: delta > 0 ? 'ccw' : 'cw',
    })

    animate(
      dot.current,
      { x: 0, y: toY },
      reduced ? { duration: 0 } : { duration: 0.25, ease: 'easeOut', path },
    )
  }, [activeIndex, animate, dot, reduced])

  const select = (index: number) => {
    if (value === undefined) setInternalValue(index)
    onChange?.(index)
  }

  return (
    <ul
      data-slot="bounce-sidebar"
      className={cn('relative flex flex-col gap-1 ps-6', className)}
      {...props}
    >
      <span
        ref={dot}
        aria-hidden
        className="absolute start-2 top-0 rounded-full transition-opacity duration-150"
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          backgroundColor: dotColor,
          // No item is current (value -1): the dot hides.
          opacity: ready && activeIndex >= 0 ? 1 : 0,
        }}
      />

      {items.map((item, index) => {
        const label = typeof item === 'string' ? item : item.label

        if (typeof item !== 'string' && 'heading' in item) {
          return (
            <li
              key={`${index}-${label}`}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              role="presentation"
              data-slot="bounce-sidebar-heading"
              style={{ color: dotColor }}
              className="px-1 pb-1 pt-7 text-[11px] font-semibold uppercase tracking-[0.14em] first:pt-0"
            >
              {label}
            </li>
          )
        }

        const href = typeof item === 'string' ? undefined : item.href
        const isActive = index === activeIndex
        const itemClassName = cn(
          'flex w-full cursor-pointer items-center rounded-lg p-1 text-start text-sm transition-colors duration-200',
          isActive ? 'text-foreground' : 'text-foreground/50',
        )

        return (
          <li
            key={`${index}-${label}`}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
          >
            {href ? (
              <MotionLink
                href={href}
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => select(index)}
                className={itemClassName}
              >
                {label}
              </MotionLink>
            ) : (
              <motion.button
                type="button"
                data-slot="bounce-sidebar-item"
                data-active={isActive}
                aria-current={isActive ? 'location' : undefined}
                onClick={() => select(index)}
                className={itemClassName}
              >
                {label}
              </motion.button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
