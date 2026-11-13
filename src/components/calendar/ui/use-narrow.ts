import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Whether the calendar is narrow, read from the `--narrow` property the
 * stylesheet sets in its container query. The width limit lives in CSS only.
 */
export function useNarrow(frame: RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState(false)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const read = () => setNarrow(getComputedStyle(el).getPropertyValue('--narrow').trim() === '1')
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [frame])

  return narrow
}
