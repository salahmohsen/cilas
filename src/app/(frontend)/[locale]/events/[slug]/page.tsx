import { type Locale } from '@/i18n/routing'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import { getPublicEvent } from '@/api/events.api'
import { EventPage } from '@/components/events/event-page'
import { buildPageMetadata, seoDefaults } from '@/lib/seo'

type Props = { params: Promise<{ locale: Locale; slug: string }> }
export const revalidate = 60
const readEvent = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayload({ config })
  return await getPublicEvent(payload, locale, slug)
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const event = await readEvent(locale, slug)
  if (!event) notFound()
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

export default async function Page({ params }: Props) {
  const { locale, slug } = await params
  const event = await readEvent(locale, slug)
  if (!event) notFound()
  return <EventPage event={event} locale={locale} />
}
