'use client'

import { useReducedMotion } from 'motion/react'
import { useEffect } from 'react'

/** How long the page must rest before a scroll counts as finished. */
const SETTLE_MS = 140

/**
 * The first screen snaps to the section with `id` (what is open for
 * registration): a scroll down that comes to rest between the top of the page
 * and that section carries on to it. Anywhere else, and every scroll up, stays
 * natural. Off with reduced motion.
 */
export function HomeSnap({ id }: { id: string }) {
  const reduced = useReducedMotion()
  useEffect(() => {
    if (reduced) return
    const section = document.getElementById(id)
    if (!section) return
    let from = window.scrollY
    let last = from
    let timer: number | undefined
    let snapping = false
    const pad = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    const settle = () => {
      timer = undefined
      if (snapping) {
        snapping = false
        return
      }
      const y = window.scrollY
      const below = section.getBoundingClientRect().top - pad()
      // Down, off the very top, and the section not reached yet: the first screen.
      if (y > from && y > 4 && below > 4 && from < y + below) {
        snapping = true
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    const onScroll = () => {
      if (timer === undefined) from = last
      last = window.scrollY
      window.clearTimeout(timer)
      timer = window.setTimeout(settle, SETTLE_MS)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
    }
  }, [id, reduced])
  return null
}
