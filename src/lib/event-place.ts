export type MeetingService = 'zoom' | 'meet' | 'teams'

export const PLACE_NAME_MAX = 120

const hostOf = (url: URL) => url.hostname.toLowerCase().replace(/^www\./, '')

export const meetingService = (raw: string): MeetingService | null => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = hostOf(url)
  if (host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com') return 'zoom'
  if (host === 'meet.google.com') return 'meet'
  if (host === 'teams.microsoft.com' || host === 'teams.live.com') return 'teams'
  return null
}

const MAPS_HOST = /^(?:maps\.)?google\.[a-z.]+$/

const clean = (text: string): string | null => {
  const name = text.replace(/\s+/g, ' ').trim()
  if (!name || /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(name)) return null
  return name.length > PLACE_NAME_MAX ? `${name.slice(0, PLACE_NAME_MAX - 1)}…` : name
}

const decode = (part: string) => {
  try {
    return decodeURIComponent(part.replace(/\+/g, ' '))
  } catch {
    return part.replace(/\+/g, ' ')
  }
}

/**
 * The place a Google Maps address names in itself: the `/maps/place/<name>/`
 * part, or the search in `?q=` or `/maps/search/<name>`. Null for a share
 * link that still has to be followed (maps.app.goo.gl), or bare coordinates.
 */
export const mapsPlace = (raw: string): string | null => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = hostOf(url)
  const maps =
    (MAPS_HOST.test(host) && (host.startsWith('maps.') || url.pathname.startsWith('/maps'))) ||
    host === 'maps.google.com'
  if (!maps) return null
  const named = /\/maps\/(?:place|search)\/([^/@]+)/.exec(url.pathname)?.[1]
  if (named) return clean(decode(named))
  const query = url.searchParams.get('q') ?? url.searchParams.get('query')
  return query ? clean(query) : null
}

/** A page title as a place name: trimmed and cut to the stored length, or null when it says nothing. */
export const titlePlace = (title: string | null | undefined): string | null =>
  title ? clean(title) : null

/** The host an address shows when nothing better is known. */
export const placeHost = (raw: string): string => {
  try {
    return hostOf(new URL(raw))
  } catch {
    return raw
  }
}
