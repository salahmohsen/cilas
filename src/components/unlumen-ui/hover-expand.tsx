'use client'

import * as React from 'react'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'
import Link from 'next/link'

export interface HoverExpandItem {
  label: string
  /** e.g. country, year, category */
  sublabel?: string
  /** omit when there is no artwork; the row then stays text-only */
  image?: string
  imageAlt?: string
  /** short descriptor shown when expanded */
  description?: string

  href: string
}

export interface HoverExpandProps {
  items: HoverExpandItem[]
  /**
   * Row height when collapsed, in pixels. Fits two wrapped label lines.
   * @default 88
   */
  collapsedHeight?: number
  /**
   * Row height when expanded, in pixels.
   * @default 320
   */
  expandedHeight?: number
  className?: string
  /** The number of the first row, when the list is one page of a longer one. */
  start?: number
}

export function HoverExpand({
  items,
  collapsedHeight = 88,
  expandedHeight = 320,
  className,
  start = 1,
}: HoverExpandProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  return (
    <div className={cn('mx-auto flex w-full  flex-col', className)}>
      <div className="w-full border-t border-current opacity-15" />

      {items.map((item, i) => {
        const isHovered = hoveredIndex === i
        const isOtherHovered = hoveredIndex !== null && !isHovered

        return (
          <React.Fragment key={i}>
            <motion.div
              className="relative w-full overflow-hidden cursor-default"
              animate={{
                height: isHovered ? expandedHeight : collapsedHeight,
                opacity: isOtherHovered ? 0.38 : 1,
              }}
              transition={{
                height: {
                  type: 'spring',
                  stiffness: 280,
                  damping: 32,
                  mass: 0.9,
                },
                opacity: { duration: 0.22, ease: 'easeOut' },
              }}
              onHoverStart={() => setHoveredIndex(i)}
              onHoverEnd={() => setHoveredIndex(null)}
            >
              <motion.div
                className="absolute inset-0 w-full h-full"
                initial={false}
                animate={{
                  opacity: isHovered ? 1 : 0,
                  scale: isHovered ? 1 : 1.06,
                }}
                transition={{
                  opacity: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
                  scale: { duration: 0.55, ease: [0.23, 1, 0.32, 1] },
                }}
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.imageAlt ?? ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                )}
                <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/30 to-black/10" />
              </motion.div>

              <div className="absolute inset-0 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-2 px-5 pt-5">
                <motion.span
                  className={cn(
                    'text-xs tabular-nums shrink-0 transition-colors duration-200',
                    isHovered ? 'text-white' : 'text-foreground',
                  )}
                  animate={{ opacity: isHovered ? 0.5 : 0.4 }}
                  transition={{ duration: 0.2 }}
                >
                  {String(i + start).padStart(2, '0')}
                </motion.span>

                <motion.span
                  className={cn(
                    'font-semibold tracking-tight transition-colors duration-200',
                    isHovered ? 'text-white' : 'text-foreground',
                  )}
                  style={{ fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)', lineHeight: 1.15 }}
                >
                  {/* dir=auto: a title in the other script keeps its own punctuation order. */}
                  <Link dir="auto" href={item.href}>
                    {item.label}
                  </Link>
                </motion.span>

                {item.sublabel && (
                  <motion.span
                    className={cn(
                      'text-xs tracking-widest uppercase shrink-0 transition-colors duration-200',
                      isHovered ? 'text-white/55' : 'text-foreground',
                    )}
                    animate={{ opacity: isHovered ? 1 : 0.45 }}
                    transition={{ duration: 0.2 }}
                  >
                    {item.sublabel}
                  </motion.span>
                )}

                {item.description && (
                  <motion.div
                    className="col-start-2 relative"
                    initial={false}
                    animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : -8 }}
                    transition={{
                      opacity: { duration: 0.35, ease: [0.23, 1, 0.32, 1] },
                      y: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
                    }}
                  >
                    <p
                      className="max-w-prose text-sm leading-relaxed       bg-black/25 -m-5 p-5 rounded-md text-white/85"
                      dir="auto"
                    >
                      <span className="shadow-xs">{item.description}</span>
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>

            <div className="w-full border-t border-current opacity-15" />
          </React.Fragment>
        )
      })}
    </div>
  )
}
