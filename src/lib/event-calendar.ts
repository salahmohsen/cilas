import type { Event } from '@/payload-types'
import { cairoDay, cairoInstant } from '@/lib/cairo-day'
import { buildIcs, type IcsEntry } from '@/lib/ics'
import { plainText } from '@/lib/plaintext'
import { expandSchedule } from '@/lib/schedule'
import { googleCalendarUrl } from '@/lib/space-event'

type Words = {
  speakers: string
  agenda: string
  admission: string
  online: string
  egp: string
  free: string
}

/** Where the event is, in one line: the venue and its address, or the online link. */
export const eventLocation = (event: Event, words: Pick<Words, 'online'>): string => {
  const place = typeof event.place === 'object' ? event.place : null
  const venue = event.external_venue?.name ? event.external_venue : place
  const parts = [venue?.name, venue?.address].filter(Boolean)
  if (parts.length) return parts.join(', ')
  return event.online_url ? `${words.online}: ${event.online_url}` : ''
}

/**
 * The event's full details as calendar text: what it is, who speaks, the
 * agenda, admission, the online link and the page.
 */
export const eventDetails = (event: Event, url: string, words: Words): string => {
  const speakers = (event.speakers ?? [])
    .flatMap(({ person, role }) =>
      typeof person === 'object' && person ? [role ? `${person.name} (${role})` : person.name] : [],
    )
    .join(', ')
  const price =
    event.pricing?.min != null
      ? event.pricing.min === 0 && !event.pricing.max
        ? words.free
        : `${event.pricing.min}${event.pricing.max ? `–${event.pricing.max}` : ''} ${words.egp}`
      : null
  return [
    event.description ? plainText({ data: event.description }).trim() : null,
    speakers ? `${words.speakers}: ${speakers}` : null,
    event.agenda?.length
      ? `${words.agenda}:\n${event.agenda.map((a) => `${a.start_time}–${a.end_time} ${a.title}`).join('\n')}`
      : null,
    [price, event.pricing?.note].filter(Boolean).length
      ? `${words.admission}: ${[price, event.pricing?.note].filter(Boolean).join('. ')}`
      : null,
    event.schedule?.note ?? null,
    event.online_url ? `${words.online}: ${event.online_url}` : null,
    url,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Every meeting of the event as a calendar entry; a date without a time is all day. */
export const eventEntries = (event: Event, url: string, words: Words): IcsEntry[] => {
  const base = {
    title: event.title,
    url,
    description: eventDetails(event, url, words),
    location: eventLocation(event, words),
  }
  if (event.schedule?.start_precision === 'week') return []
  const meetings = expandSchedule(event.schedule)
  if (meetings.length)
    return meetings.map((m) => ({
      ...base,
      uid: `event-${event.id}-${m.date}-${m.start_time.replace(':', '')}@cilas.org`,
      date: m.date,
      start: m.start_time,
      end: m.end_time,
    }))
  const day = event.schedule?.start_date ? cairoDay(event.schedule.start_date) : null
  return day ? [{ ...base, uid: `event-${event.id}@cilas.org`, date: day }] : []
}

export const eventIcs = (event: Event, url: string, words: Words): string | null => {
  const entries = eventEntries(event, url, words)
  return entries.length ? buildIcs(entries, { name: event.title }) : null
}

/** A prefilled Google Calendar page for the event's next (or only) timed meeting. */
export const eventGoogleUrl = (
  event: Event,
  meeting: { date: string; start_time: string; end_time: string } | undefined,
  url: string,
  words: Words,
): string | null => {
  if (!meeting) return null
  const startsAt = cairoInstant(meeting.date, meeting.start_time)
  if (!startsAt) return null
  return googleCalendarUrl({
    title: event.title,
    startsAt,
    endsAt: cairoInstant(meeting.date, meeting.end_time),
    location: eventLocation(event, words),
    details: eventDetails(event, url, words),
  })
}
