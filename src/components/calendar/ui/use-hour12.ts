import { useEffect, useState } from 'react'

const KEY = 'calendar-hour-format'

/** 24-hour or 12-hour times, kept for this viewer in the browser. */
export function useHour12() {
  const [hour12, setHour12] = useState(false)

  useEffect(() => {
    try {
      setHour12(localStorage.getItem(KEY) === '12')
    } catch {
      // Storage can be blocked (private windows, site data off): keep 24 hours.
    }
  }, [])

  const choose = (next: boolean) => {
    setHour12(next)
    try {
      localStorage.setItem(KEY, next ? '12' : '24')
    } catch {
      // Blocked storage: the choice lasts until the page closes.
    }
  }

  return [hour12, choose] as const
}
