import type { Payload } from 'payload'
import type { Locale } from '@/api/articles.api'
import { PUBLIC_PROFILE_FIELDS } from '@/lib/public-profile'

export const getPublicEvents = async (payload: Payload, locale: Locale, slug?: string) => {
  const { docs } = await payload.find({
    collection: 'events',
    where: { and: [{ tier: { equals: 'public' } }, ...(slug ? [{ slug: { equals: slug } }] : [])] },
    locale,
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
    overrideAccess: false,
    depth: 2,
    pagination: false,
    sort: 'schedule.start_date',
    populate: {
      media: { url: true, alt: true, focalX: true, focalY: true, filename: true, prefix: true },
      people: PUBLIC_PROFILE_FIELDS,
      places: { name: true, address: true, map_url: true },
    },
  })
  return docs
}
