import { useEffect, useState } from 'react'

import { cairoNow } from './calendar-time'

/**
 * The Cairo day and minute, once the page is in the browser. The server
 * renders none, so the markup it sends does not depend on when it was sent.
 */
export function useNow() {
  const [now, setNow] = useState<ReturnType<typeof cairoNow> | null>(null)

  useEffect(() => {
    const tick = () => setNow(cairoNow())
    tick()
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, [])

  return now
}
