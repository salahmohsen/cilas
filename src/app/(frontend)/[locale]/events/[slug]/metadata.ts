import { getPublicEvent } from '@/api/events.api'
import type { Locale } from '@/i18n/routing'
import { detailPath } from '@/lib/paths'
import { buildPageMetadata, seoDefaults } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { cache } from 'react'

export const readEvent = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayload({ config })
  return await getPublicEvent(payload, locale, slug)
})

/** The event page's metadata, or null when there is no such public event. Shared with its share card. */
export async function eventMetadata(locale: Locale, slug: string): Promise<Metadata | null> {
  const event = await readEvent(locale, slug)
  if (!event) return null
  const metaImage = typeof event.meta?.image === 'object' ? event.meta.image : null
  const cover = typeof event.cover_image === 'object' ? event.cover_image : null
  const title = event.meta?.title || event.title
  const description =
    event.meta?.description ||
    seoDefaults('events', event as unknown as Record<string, unknown>).description
  const metadata = buildPageMetadata({
    title,
    description,
    image: metaImage?.url || cover?.url,
    path: detailPath('events', String(event.slug)),
    locale,
  })
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, url: detailPath('events', String(event.slug), locale) },
    twitter: { ...metadata.twitter, title, description },
  }
}
