import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

type Options = {
  /** Only a grid that scrolls has anything to scroll to. */
  enabled: boolean
  /** The minute that goes near the top. */
  minutes: number
  range: { min: number; max: number }
  /** Changes when the week changes. */
  week: string
}

/**
 * Scrolls a grid's hours so `minutes` sits just under the sticky day headers,
 * when the grid opens and when the week changes. The headers are sticky at the
 * top of the scroller, so the hours start right under them and the offset into
 * the track is the offset to scroll to. Opening is instant; a week change is
 * smooth unless the viewer asks for less motion.
 */
export function useScrollToWork(scroller: RefObject<HTMLElement | null>, options: Options) {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  const opened = useRef(false)
  const { enabled, week } = options
  useLayoutEffect(() => {
    const el = scroller.current
    if (!enabled || !el) return
    const { minutes, range } = latest.current
    const track = el.querySelector<HTMLElement>('[data-track][data-selected]')
    const hours = (range.max - range.min) / 60
    if (!track || !hours) return
    const hourSize = track.offsetHeight / hours
    const top = Math.max(0, ((minutes - range.min) / 60 - 0.25) * hourSize)
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo?.({ top, behavior: opened.current && !calm ? 'smooth' : 'instant' })
    opened.current = true
  }, [scroller, enabled, week])
}
