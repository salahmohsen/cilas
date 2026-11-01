import type { AnalyticsEvent, AnalyticsEvents } from './events'
import { mayCapture } from './policy'

type Sender = (event: string, properties?: Record<string, unknown>) => void

/** The running PostHog, set once by instrumentation-client.ts. Null means off. */
let sender: Sender | null = null

export const setSender = (next: Sender | null) => {
  sender = next
}

/**
 * Records that something happened. Does nothing when PostHog is off (no key,
 * or "Do Not Track" on) or when the page is one analytics may not see, apart
 * from the two events that are allowed anywhere (src/lib/analytics/events.ts).
 * Never throws: a failing counter must not break a form.
 */
export function track<E extends AnalyticsEvent>(event: E, properties?: AnalyticsEvents[E]): void {
  if (!sender || typeof window === 'undefined') return
  try {
    if (!mayCapture(event, window.location.pathname)) return
    sender(event, properties)
  } catch {}
}
