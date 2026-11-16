import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Whether the calendar is narrow, read from the `--narrow` property the
 * stylesheet sets in its container query. The width limit lives in CSS only.
 * Null until it is measured: the server and the first render do not know it.
 */
export function useNarrow(frame: RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState<boolean | null>(null)

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
