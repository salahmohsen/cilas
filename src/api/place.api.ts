import config from '@payload-config'
import { getPayload } from 'payload'

export type Place = { name: string; address: string; mapUrl: string | null }

/**
 * Where CILAS is now: the current space with an address, in the page's
 * language, for the footer's map. Null when no current space has one.
 */
export const getCurrentPlace = async (locale: 'en' | 'ar'): Promise<Place | null> => {
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'spaces',
    where: { state: { equals: 'current' } },
    depth: 0,
    limit: 5,
    locale,
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
    overrideAccess: false,
  })
  const space = docs.find((s) => s.address?.trim())
  return space ? { name: space.name, address: space.address!.trim(), mapUrl: space.map_url ?? null } : null
}
