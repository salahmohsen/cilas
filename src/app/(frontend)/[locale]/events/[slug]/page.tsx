import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import type { Metadata } from 'next'
import { cache } from 'react'
import type { Locale } from '@/api/articles.api'
import { getPublicEvents } from '@/api/events.api'
import { EventPage } from '@/components/events/event-page'
import { plainText } from '@/lib/plaintext'
import { pageAlternates } from '@/lib/seo'
import { ogImages } from '@/lib/og'

type Props = { params: Promise<{ locale: Locale; slug: string }> }
export const revalidate = 60
const readEvent = cache(async (locale: Locale, slug: string) => {
  const payload = await getPayload({ config })
  return (await getPublicEvents(payload, locale, slug))[0]
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const event = await readEvent(locale, slug)
  if (!event) notFound()
  const metaImage = typeof event.meta?.image === 'object' ? event.meta.image : null
  const cover = typeof event.cover_image === 'object' ? event.cover_image : null
  const images = ogImages(metaImage?.url || cover?.url)
  const title = event.meta?.title || event.title
  const description =
    event.meta?.description ||
    (event.description ? plainText({ data: event.description }).slice(0, 160) : undefined)
  return {
    title,
    description,
    alternates: pageAlternates(`/events/${event.slug}`, locale),
    openGraph: { title, description, url: `/${locale}/events/${event.slug}`, images },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((image) => image.url),
    },
  }
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params
  const event = await readEvent(locale, slug)
  if (!event) notFound()
  return <EventPage event={event} locale={locale} />
}
