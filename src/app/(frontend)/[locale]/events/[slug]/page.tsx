import { type Locale } from '@/i18n/routing'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EventPage } from '@/components/events/event-page'
import { withShareCard } from '@/lib/seo'

import { eventMetadata, readEvent } from './metadata'

type Props = { params: Promise<{ locale: Locale; slug: string }> }
export const revalidate = 60

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const metadata = await eventMetadata(locale, slug)
  if (!metadata) notFound()
  return withShareCard(metadata)
}

export default async function Page({ params }: Props) {
  const { locale, slug } = await params
  const event = await readEvent(locale, slug)
  if (!event) notFound()
  return <EventPage event={event} locale={locale} />
}
