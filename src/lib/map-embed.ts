/**
 * The address of an embedded Google map for a place. A free-text street
 * address is geocoded by Google and can land on the wrong street, so the
 * place's own Maps link wins: its pin (`!3d<lat>!4d<lng>`) or, failing that,
 * its view centre (`@<lat>,<lng>`). A share link (maps.app.goo.gl) is
 * followed once to the full address, and the answer is cached for a day.
 */
export const mapEmbedUrl = async (
  place: { address: string | null; mapUrl: string | null },
  locale: string,
): Promise<string | null> => {
  const at = place.mapUrl ? coordinatesOf(await expanded(place.mapUrl)) : null
  const q = at ? `${at.lat},${at.lng}` : place.address
  if (!q) return null
  return `https://www.google.com/maps?${new URLSearchParams({ q, hl: locale, z: '17', output: 'embed' })}`
}

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl'])

const expanded = async (raw: string): Promise<string> => {
  try {
    if (!SHORT_HOSTS.has(new URL(raw).hostname)) return raw
    const res = await fetch(raw, {
      redirect: 'manual',
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(3000),
    })
    return res.headers.get('location') ?? raw
  } catch {
    return raw
  }
}

const coordinatesOf = (url: string): { lat: number; lng: number } | null => {
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(url)
  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(url)
  const match = pin ?? view
  if (!match) return null
  const lat = Number(match[1]),
    lng = Number(match[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}
