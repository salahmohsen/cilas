import type { Payload } from 'payload'
import type { Locale } from '@/api/articles.api'

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
      media: { url: true, alt: true, sizes: true, filename: true, prefix: true },
      people: { name: true, slug: true },
      places: { name: true, address: true, map_url: true },
    },
  })
  return docs
}
