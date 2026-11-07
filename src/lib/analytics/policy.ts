import { ANYWHERE_EVENTS } from './events'
import { isTrackedPath, reportedPath } from './paths'
import { scrubReferrer, scrubText, scrubUrl } from './scrub'

type Properties = Record<string, unknown>
export type Capture = { event: string; properties?: Properties }

/** What replaces the address of a page analytics may not see. */
const HIDDEN_URL = '/[private]'

/**
 * Properties that hold an address, found by name, not by a list of known keys:
 * PostHog adds new ones as it grows (`$session_entry_url`,
 * `$prev_pageview_pathname`), and each must be cleaned without a change here.
 */
const URL_KEY = /_url$/
const PATH_KEY = /pathname$/
const REFERRER_KEY = /referrer$/
/** A search engine's query, taken from the referrer: what someone searched for. */
const KEYWORD_KEY = /keyword/
/** About the page before or the page a visit started on, which may be private. */
const CONTEXT_KEY = /^\$(session_entry|prev_pageview)_/

const SCHEME = /^[a-z][a-z0-9+.-]*:/i
const looksLikeAddress = (value: unknown): value is string =>
  typeof value === 'string' && (value.startsWith('/') || SCHEME.test(value))

const SITE = 'https://invalid.local'

const pathOf = (url: unknown): string | null => {
  if (typeof url !== 'string' || !url) return null
  try {
    return new URL(url, SITE).pathname
  } catch {
    return null
  }
}

/** The site's own origin: from the event's address, else from the page. */
const siteOrigin = (currentUrl: unknown): string => {
  if (typeof currentUrl === 'string' && SCHEME.test(currentUrl)) {
    try {
      return new URL(currentUrl).origin
    } catch {}
  }
  return globalThis.location?.origin || SITE
}

/**
 * One address property, cleaned, or undefined to drop it. An address on this
 * site is dropped when its page is private and otherwise loses its query and
 * any person's name; an address elsewhere keeps only its origin and path.
 */
const cleanAddress = (key: string, value: string, site: string): string | undefined => {
  let url: URL
  try {
    url = new URL(value, site)
  } catch {
    return undefined
  }
  if (url.origin !== site) return PATH_KEY.test(key) ? undefined : scrubReferrer(url.href)
  if (!isTrackedPath(url.pathname)) return undefined
  return PATH_KEY.test(key) ? reportedPath(url.pathname) : scrubUrl(value)
}

const isAddressKey = (key: string) =>
  URL_KEY.test(key) || PATH_KEY.test(key) || REFERRER_KEY.test(key)

/** An error's message can quote a token or an email, as a server error's can. */
const cleanExceptions = (list: unknown): unknown =>
  Array.isArray(list)
    ? list.map((item) =>
        item && typeof item === 'object' && typeof item.value === 'string'
          ? { ...item, value: scrubText(item.value) }
          : item,
      )
    : list

/** May this event leave the browser from this page? */
export const mayCapture = (event: string, pathname: string): boolean =>
  isTrackedPath(pathname) || ANYWHERE_EVENTS.has(event)

/**
 * The last gate before an event is sent (PostHog's `before_send`). It drops
 * every event raised on a page analytics may not see, whatever raised it
 * (a page view, a recording, an error), lets the two "anywhere" events
 * through with no page information, and cleans every address on the rest:
 * the current page, the referrer, the page a visit started on and the page
 * before. Returns null to drop.
 */
export const gateCapture = (capture: Capture | null): Capture | null => {
  if (!capture) return null
  const properties: Properties = { ...capture.properties }
  // No address means PostHog could not tell: treat it as the page we are on.
  const where = pathOf(properties.$current_url) ?? (globalThis.location?.pathname || '/')
  if (!mayCapture(capture.event, where)) return null

  if (!isTrackedPath(where)) {
    for (const key of Object.keys(properties)) {
      if (isAddressKey(key) || KEYWORD_KEY.test(key) || CONTEXT_KEY.test(key)) {
        delete properties[key]
      }
    }
    properties.$current_url = HIDDEN_URL
    properties.$pathname = HIDDEN_URL
    return { ...capture, properties }
  }

  const site = siteOrigin(properties.$current_url)
  for (const [key, value] of Object.entries(properties)) {
    if (KEYWORD_KEY.test(key)) {
      delete properties[key]
    } else if (isAddressKey(key) && looksLikeAddress(value)) {
      const cleaned = cleanAddress(key, value, site)
      if (cleaned === undefined) delete properties[key]
      else properties[key] = cleaned
    }
  }
  if ('$exception_list' in properties) {
    properties.$exception_list = cleanExceptions(properties.$exception_list)
  }
  return { ...capture, properties }
}
