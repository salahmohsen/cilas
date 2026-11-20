import { type Locale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { EventPage } from '@/components/events/event-page'
import { getEventPreview } from '@/lib/event-preview'
import { currentReader } from '@/lib/reader'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Event preview',
}

export default async function Preview({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>
}) {
  const user = await currentReader()
  const { id, locale } = await params
  const event = await getEventPreview(await getPayload({ config }), Number(id), locale, user)
  if (!event) notFound()
  return (
    <EventPage
      event={{
        ...event,
        title: event.title || 'Untitled event',
        event_type: event.event_type || 'other',
      }}
      locale={locale}
      preview
    />
  )
}
