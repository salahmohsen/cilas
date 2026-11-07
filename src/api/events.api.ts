import { type Locale, otherLocale } from '@/i18n/routing'
import { mediaPopulate } from '@/lib/media-image'
import type { Payload } from 'payload'

import { PUBLIC_PROFILE_FIELDS } from '@/lib/public-profile'

const eventReadOptions = (locale: Locale) => ({
  collection: 'events' as const,
  locale,
  fallbackLocale: otherLocale(locale),
  overrideAccess: false as const,
  depth: 2,
  pagination: false,
  sort: 'schedule.start_date',
  populate: {
    media: {
      ...mediaPopulate,
      width: true,
      height: true,
      sizes: true,
      mimeType: true,
    },
    people: PUBLIC_PROFILE_FIELDS,
    places: { name: true, address: true, map_url: true },
  } as const,
})
export const getPublicEvents = async (payload: Payload, locale: Locale) => {
  const { docs } = await payload.find({
    ...eventReadOptions(locale),
    where: { and: [{ tier: { equals: 'public' } }] },
  })
  return docs
}
export const getPublicEvent = async (payload: Payload, locale: Locale, slug: string) => {
  const { docs } = await payload.find({
    ...eventReadOptions(locale),
    where: { and: [{ tier: { equals: 'public' } }, { slug: { equals: slug } }] },
  })
  return docs[0]
}
