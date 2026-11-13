import { cairoDay, cairoInstant } from '@/lib/cairo-day'
import { pathOf } from '@/lib/paths'
import { CURRENCY, defaultAmountOf } from '@/lib/pricing'
import { expandSchedule, hasDayPrecision } from '@/lib/schedule'
import { absoluteUrl, CONTEXT, personRef, plainOf } from '@/lib/schema'
import type { Event } from '@/payload-types'

/** Google event markup belongs on a detail page with a known day and physical address. */
export const eventSchema = ({
  event,
  locale,
  siteName,
}: {
  event: Event
  locale: string
  siteName: string
}) => {
  const page = pathOf('events', event, locale)
  if (!page || !hasDayPrecision(event.schedule)) return null
  const place = event.place && typeof event.place === 'object' ? event.place : null
  const venue = event.external_venue?.name
    ? {
        name: event.external_venue.name,
        address: event.external_venue.address,
        mapUrl: event.external_venue.map_url,
      }
    : place
      ? { name: place.name, address: place.address, mapUrl: place.map_url }
      : null
  const online = event.online_url
  if (!venue?.name || !venue.address) return null

  const meetings = expandSchedule(event.schedule).filter((m) => !m.cancelled)
  const first = meetings[0]
  const last = meetings.at(-1) ?? first ?? null
  const exact =
    first && last
      ? {
          startDate: cairoInstant(first.date, first.start_time),
          endDate: cairoInstant(last.date, last.end_time),
        }
      : null
  // No weekly times: the day it starts, running the agenda's hours when the
  // agenda has times, else the bare day (Google wants no made-up midnight).
  const day = !first && event.schedule?.start_date ? cairoDay(event.schedule.start_date) : null
  const agendaOpen = event.agenda?.map((item) => item.start_time).sort()[0]
  const agendaClose = event.agenda
    ?.map((item) => item.end_time)
    .sort()
    .at(-1)
  const times =
    exact ??
    (day
      ? agendaOpen && agendaClose
        ? { startDate: cairoInstant(day, agendaOpen), endDate: cairoInstant(day, agendaClose) }
        : { startDate: day, endDate: day }
      : null)
  if (!times?.startDate || !times.endDate) return null

  const price = defaultAmountOf(event.pricing) ?? null

  const speakers = (event.speakers ?? [])
    .flatMap((s) => (typeof s.person === 'object' ? [s.person] : []))
    .map((p) => personRef(p, locale))

  return {
    '@context': CONTEXT,
    '@type': 'Event',
    name: event.title,
    url: absoluteUrl(page),
    ...(typeof event.cover_image === 'object' && event.cover_image?.url
      ? { image: [absoluteUrl(event.cover_image.url)] }
      : {}),
    ...(event.description?.root?.children?.length
      ? { description: plainOf(event.description) }
      : {}),
    eventAttendanceMode: online
      ? `${CONTEXT}/MixedEventAttendanceMode`
      : `${CONTEXT}/OfflineEventAttendanceMode`,
    location: [
      {
        '@type': 'Place',
        name: venue.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: venue.address,
          addressCountry: 'EG',
        },
        ...(venue.mapUrl ? { hasMap: venue.mapUrl } : {}),
      },
      ...(online ? [{ '@type': 'VirtualLocation', url: online }] : []),
    ],
    startDate: times.startDate,
    endDate: times.endDate,
    ...(speakers.length ? { performer: speakers } : {}),
    ...(price !== null
      ? {
          offers: {
            '@type': 'Offer',
            price,
            priceCurrency: CURRENCY,
            ...(event.registration?.url ? { url: absoluteUrl(event.registration.url) } : {}),
          },
        }
      : {}),
    organizer: { '@type': 'EducationalOrganization', name: siteName, url: absoluteUrl('/') },
  }
}
