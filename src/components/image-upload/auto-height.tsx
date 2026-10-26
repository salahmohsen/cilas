'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { animate, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'

import { motionTokens } from '@/components/arc/lib/motion-tokens'

/**
 * Follows its content's height on the smooth spring. It clips only while the
 * height moves; at rest it is auto and clips nothing, so focus rings and the
 * upload ring are never cut and a late size change is never hidden.
 */
export function AutoHeight({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const reduce = !!useReducedMotion()
  useEffect(() => {
    const box = outer.current
    const content = inner.current
    if (!box || !content || typeof ResizeObserver === 'undefined') return
    let last = content.offsetHeight
    let running: AnimationPlaybackControls | null = null
    // Runs after layout and before paint, so the old height holds for the first frame.
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight
      if (next === last || reduce) {
        last = next
        return
      }
      const from = running ? box.offsetHeight : last
      last = next
      running?.stop()
      box.style.overflow = 'hidden'
      running = animate(box, { height: [from, next] }, motionTokens.spring.smooth)
      void running.finished.then(() => {
        running = null
        box.style.height = ''
        box.style.overflow = ''
      })
    })
    observer.observe(content)
    return () => {
      observer.disconnect()
      running?.stop()
    }
  }, [reduce])
  return (
    <div ref={outer}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
