import { localeOf } from '@/i18n/routing'
import { detailPath } from '@/lib/paths'
import config from '@payload-config'
import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getPublicEvent } from '@/api/events.api'
import { eventIcs } from '@/lib/event-calendar'
import { absoluteUrl } from '@/lib/schema'

/**
 * One public event as an iCalendar file, every meeting with its full
 * details: `/en/events/<slug>/event.ics`. The UIDs are stable, so adding it
 * again updates the same entries.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; slug: string }> },
) {
  const { locale, slug } = await params
  const lang = localeOf(locale)
  const payload = await getPayload({ config })
  const event = await getPublicEvent(payload, lang, slug)
  if (!event) return new Response('Not found', { status: 404 })
  const t = await getTranslations({ locale: lang, namespace: 'Events' })
  const ics = eventIcs(event, absoluteUrl(detailPath('events', String(event.slug), lang)), {
    speakers: t('speakers'),
    agenda: t('agenda'),
    admission: t('admission'),
    online: t('online'),
    egp: t('egp'),
    free: t('free'),
  })
  if (!ics) return new Response('This event has no date yet.', { status: 404 })
  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="cilas-${event.slug}.ics"`,
      'cache-control': 'public, max-age=300',
    },
  })
}
