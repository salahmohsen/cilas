import { ANYWHERE_EVENTS } from './events'
import { isTrackedPath, reportedPath } from './paths'
import { scrubReferrer, scrubUrl } from './scrub'

type Properties = Record<string, unknown>
export type Capture = { event: string; properties?: Properties }

const HIDDEN_URL = '/[private]'

const pathOf = (url: unknown): string | null => {
  if (typeof url !== 'string' || !url) return null
  try {
    return new URL(url, 'https://invalid.local').pathname
  } catch {
    return null
  }
}

/** May this event leave the browser from this page? */
export const mayCapture = (event: string, pathname: string): boolean =>
  isTrackedPath(pathname) || ANYWHERE_EVENTS.has(event)

/**
 * The last gate before an event is sent (PostHog's `before_send`). It drops
 * every event raised on a page analytics may not see, whatever raised it
 * (a page view, a recording, an error), lets the two "anywhere" events
 * through with no page information, and cleans the address on the rest.
 * Returns null to drop.
 */
export const gateCapture = (capture: Capture | null): Capture | null => {
  if (!capture) return null
  const properties: Properties = { ...capture.properties }
  const where = pathOf(properties.$current_url) ?? (globalThis.location?.pathname || '/')
  if (!mayCapture(capture.event, where)) return null

  if (!isTrackedPath(where)) {
    properties.$current_url = HIDDEN_URL
    properties.$pathname = HIDDEN_URL
    delete properties.$referrer
    delete properties.$referring_domain
    return { ...capture, properties }
  }
  if (typeof properties.$current_url === 'string') {
    properties.$current_url = scrubUrl(properties.$current_url)
  }
  if (typeof properties.$pathname === 'string') {
    properties.$pathname = reportedPath(properties.$pathname)
  }
  if (typeof properties.$referrer === 'string') {
    properties.$referrer = scrubReferrer(properties.$referrer)
  }
  return { ...capture, properties }
}
