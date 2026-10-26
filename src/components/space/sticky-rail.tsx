'use client'

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** The rail's own height, for CSS: a rail taller than the screen sticks by its bottom edge, so all of it is reachable. */
export function StickyRail({
  className,
  label,
  children,
}: {
  className: string
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(() =>
      node.style.setProperty('--rail-height', `${node.offsetHeight}px`),
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
    <aside ref={ref} className={className} aria-label={label}>
      {children}
    </aside>
  )
}
