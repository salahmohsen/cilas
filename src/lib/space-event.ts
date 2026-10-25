/** Rules and formats of an event post that both the server and the card share. */

export const RSVP_STATUSES = ['going', 'maybe', 'not_going'] as const
export type RsvpStatus = (typeof RSVP_STATUSES)[number]

export const isRsvpStatus = (value: unknown): value is RsvpStatus =>
  RSVP_STATUSES.includes(value as RsvpStatus)

/** Without an end, a calendar entry still needs a length. */
const DEFAULT_LENGTH_MS = 60 * 60 * 1000

/**
 * The address an event's place names, or null for a plain place: the whole
 * text must be one http or https address with a host and no spaces.
 */
export const locationUrl = (location: string | null | undefined): string | null => {
  const text = (location ?? '').trim()
  if (!text || /\s/.test(text) || !/^https?:\/\//i.test(text)) return null
  try {
    const url = new URL(text)
    return url.hostname ? url.href : null
  } catch {
    return null
  }
}

/** When the event is over: its end, or its start when it has none. */
export const eventOver = (
  startsAt: string,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean => new Date(endsAt || startsAt).getTime() < now.getTime()

/** The first line of the post as plain text, for a calendar entry's title. */
export const eventTitle = (body: string, fallback: string): string => {
  const line = body
    .split('\n')
    .map((l) =>
      l
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^[#>\-*\s]+/, '')
        .replace(/[*_`~]/g, '')
        .trim(),
    )
    .find(Boolean)
  return line ? (line.length > 80 ? `${line.slice(0, 79)}…` : line) : fallback
}

const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

const endOf = (startsAt: string, endsAt: string | null | undefined) =>
  endsAt || new Date(new Date(startsAt).getTime() + DEFAULT_LENGTH_MS).toISOString()

export type CalendarEvent = {
  title: string
  startsAt: string
  endsAt?: string | null
  location: string
  details?: string
}

/** A prefilled "add event" page on Google Calendar. Times are UTC instants, so no zone name is needed. */
export const googleCalendarUrl = (event: CalendarEvent): string => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.startsAt)}/${stamp(endOf(event.startsAt, event.endsAt))}`,
    location: event.location,
  })
  if (event.details) params.set('details', event.details)
  return `https://calendar.google.com/calendar/render?${params}`
}

const escapeText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545 §3.1: lines fold at 75 octets, the continuation starting with one space. */
const fold = (line: string): string => {
  const out: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = Buffer.byteLength(char)
    if (size + bytes > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes
  }
  out.push(current)
  return out.join('\r\n ')
}

/** A valid iCalendar file with one event; the UID is stable for a post, so a re-download updates it. */
export const icsFor = (
  event: CalendarEvent & { uid: string; url?: string },
  now: Date = new Date(),
): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CILAS//Spaces//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `DTEND:${stamp(endOf(event.startsAt, event.endsAt))}`,
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.location)}`,
    ...(event.details || event.url
      ? [`DESCRIPTION:${escapeText([event.details, event.url].filter(Boolean).join('\n\n'))}`]
      : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
