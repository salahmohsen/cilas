import { otherLocale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'

export type Place = { name: string; address: string; mapUrl: string | null }

/**
 * Where CILAS is now: the current place with an address, in the page's
 * language, for the footer's map. Null when no current place has one.
 */
export const getCurrentPlace = async (locale: 'en' | 'ar'): Promise<Place | null> => {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'places',
    where: { state: { equals: 'current' } },
    depth: 0,
    limit: 5,
    locale,
    fallbackLocale: otherLocale(locale),
    overrideAccess: false,
  })
  const place = docs.find((s) => s.address?.trim())
  return place
    ? { name: place.name, address: place.address!.trim(), mapUrl: place.map_url ?? null }
    : null
}
