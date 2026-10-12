'use client'

/**
 * Componentry's Orbit Card Stack (componentry.dev/docs/components/orbit-card-stack),
 * adapted: cards are links, colours come from the site's tokens so both
 * themes work, motion comes from `motion/react` (already a dependency), the
 * fan follows the reading direction, and a card without an image shows its
 * initials on a plain surface instead of the drawn portrait.
 */

import { ArrowUpRight } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { type CSSProperties, type FocusEvent, useMemo, useRef, useState } from 'react'

import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

export interface OrbitStackItem {
  /** The card's heading. */
  name: string
  /** The small line above it. */
  role: string
  description: string
  href: string
  image?: string
  imageAlt?: string
  initials?: string
  /** The footer line, e.g. its place in a series. */
  stat?: string
}

interface OrbitCardStackProps {
  items: OrbitStackItem[]
  className?: string
  cardClassName?: string
  defaultActiveIndex?: number
  spread?: number
  lift?: number
  label: string
  onActiveChange?: (item: OrbitStackItem, index: number) => void
  dir?: 'ltr' | 'rtl'
}

const inRange = (index: number, length: number) => Math.min(Math.max(0, index), Math.max(0, length - 1))

const initialsFor = (item: OrbitStackItem) =>
  item.initials ??
  item.name
    .split(/\s+/)
    .map((part) => part.at(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

function Portrait({ item }: { item: OrbitStackItem }) {
  return (
    <div className="relative flex aspect-[1.36] w-full overflow-hidden rounded-[1.15rem] bg-[var(--surface-muted,var(--muted))] outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={item.imageAlt ?? ''} className="h-full w-full object-cover" src={item.image} />
      ) : (
        <span className="m-auto font-serif-reading text-5xl text-[var(--text-muted)]">{initialsFor(item)}</span>
      )}
    </div>
  )
}

export function OrbitCardStack({
  items,
  className,
  cardClassName,
  defaultActiveIndex = 0,
  spread = 168,
  lift = 34,
  label,
  onActiveChange,
  dir = 'ltr',
}: OrbitCardStackProps) {
  const reduceMotion = useReducedMotion() ?? false
  const restingIndex = inRange(defaultActiveIndex, items.length)
  const [activeIndex, setActiveIndex] = useState(restingIndex)
  const [open, setOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const midpoint = (items.length - 1) / 2
  // In RTL the first card sits on the right, where reading starts.
  const side = dir === 'rtl' ? -1 : 1

  const layouts = useMemo(
    () =>
      items.map((_, index) => {
        const orbit = (index - midpoint) * side
        const stack = (index - restingIndex) * side
        return {
          open: {
            x: orbit * spread,
            y: Math.abs(orbit) * 30 + Math.max(0, Math.abs(orbit) - 1) * 10,
            rotation: orbit * 8.5,
          },
          closed: { x: stack * 10, y: Math.abs(stack) * 5, rotation: stack * 2.8 },
        }
      }),
    [items, midpoint, restingIndex, spread, side],
  )

  const activate = (index: number) => {
    const next = inRange(index, items.length)
    setOpen(true)
    setActiveIndex(next)
    onActiveChange?.(items[next]!, next)
  }
  const close = () => {
    setOpen(false)
    setActiveIndex(restingIndex)
  }
  const leaveFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close()
  }
  const focusCard = (index: number) =>
    stageRef.current?.querySelectorAll<HTMLElement>('[data-orbit-card]')[index]?.focus()

  return (
    <div className={cn('relative flex w-full items-center justify-center p-8', className)}>
      <div
        aria-label={label}
        className="relative h-[540px] w-full max-w-[980px]"
        onBlur={leaveFocus}
        onMouseLeave={close}
        ref={stageRef}
        role="list"
      >
        {items.map((item, index) => {
          const position = open ? layouts[index]!.open : layouts[index]!.closed
          const active = index === activeIndex
          const style: CSSProperties = {
            zIndex: active ? 80 : 50 - Math.abs(index - activeIndex),
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${
              position.y - (open && active ? lift : 0)
            }px)) rotate(${position.rotation}deg) scale(${open ? 0.985 : 0.97})`,
            transitionDuration: reduceMotion ? '0ms' : '420ms',
          }

          return (
            <div className="contents" key={`${item.href}-${index}`} role="listitem">
              <Link
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'absolute top-1/2 left-1/2 block w-[min(78vw,21rem)] origin-bottom rounded-[1.6rem] bg-[var(--card)] p-4 text-[var(--foreground)] outline-none',
                  'shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_8px_24px_oklch(0_0_0/0.08)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1),0_8px_24px_oklch(0_0_0/0.4)]',
                  'transition-[transform] ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
                  cardClassName,
                )}
                data-orbit-card
                href={item.href}
                onFocus={() => activate(index)}
                onKeyDown={(event) => {
                  const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
                  const back = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
                  if (event.key === forward || event.key === 'ArrowDown') {
                    event.preventDefault()
                    const next = (index + 1) % items.length
                    activate(next)
                    focusCard(next)
                  }
                  if (event.key === back || event.key === 'ArrowUp') {
                    event.preventDefault()
                    const next = (index - 1 + items.length) % items.length
                    activate(next)
                    focusCard(next)
                  }
                  if (event.key === 'Escape') {
                    event.currentTarget.blur()
                    close()
                  }
                }}
                onMouseEnter={() => activate(index)}
                style={style}
              >
                <div className="relative">
                  <Portrait item={item} />
                  <span className="absolute end-3 top-3 grid size-10 place-items-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)]">
                    <ArrowUpRight aria-hidden className="size-4 rtl:-scale-x-100" />
                  </span>
                </div>
                <div className="px-2 pt-5 pb-2">
                  <p className="text-xs text-[var(--text-muted)]">{item.role}</p>
                  <h3 className="mt-2 text-[1.45rem] leading-[1.15] font-semibold tracking-[-0.02em] text-balance rtl:tracking-normal">
                    {item.name}
                  </h3>
                  <p className="mt-3 line-clamp-3 text-[0.92rem] leading-[1.5] text-[var(--text-secondary)]">
                    {item.description}
                  </p>
                  {item.stat ? (
                    <div className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
                      {item.stat}
                    </div>
                  ) : null}
                </div>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
