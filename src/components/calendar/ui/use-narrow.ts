import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Whether the stylesheet's container query has set a flag (`--narrow`,
 * `--docked`) on the calendar's frame. The width limits live in CSS only.
 * Null until it is measured: the server and the first render do not know it.
 */
function useFlag(frame: RefObject<HTMLElement | null>, name: string) {
  const [flag, setFlag] = useState<boolean | null>(null)

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return
    const read = () => setFlag(getComputedStyle(el).getPropertyValue(name).trim() === '1')
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [frame, name])

  return flag
}

/** Whether the calendar is as narrow as a phone's. */
export const useNarrow = (frame: RefObject<HTMLElement | null>) => useFlag(frame, '--narrow')

/** Whether the calendar is wide enough for its side panel to sit beside the grid. */
export const useDocked = (frame: RefObject<HTMLElement | null>) => useFlag(frame, '--docked')
