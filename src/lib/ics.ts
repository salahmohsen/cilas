import { addDays, CAIRO } from '@/lib/cairo-day'

/**
 * The calendar as an iCalendar feed (RFC 5545), for download or for a
 * calendar app to subscribe to. Times are Cairo wall-clock (ADR 0002); they
 * are written in UTC, so every app places them right whatever its zone,
 * across Egypt's daylight-saving changes.
 */

export type IcsEntry = {
  uid: string
  title: string
  date: string
  start?: string
  end?: string
  url?: string
  description?: string
  location?: string
  cancelled?: boolean
}

/** The UTC instant of a Cairo day and `HH:MM`. */
export const cairoToUtc = (day: string, time: string): Date => {
  const [y, m, d] = day.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, min)
  // Cairo's offset at that moment: format the guess in Cairo and compare.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CAIRO,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess))
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asCairo = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
  )
  return new Date(guess - (asCairo - guess))
}

const stamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Escapes text for a property value. */
const text = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Folds a line at 75 octets, as the format asks; continuation lines start with a space. */
const fold = (line: string): string => {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const out: string[] = []
  let current = ''
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (out.length ? 74 : 75)) {
      out.push(current)
      current = char
    } else current += char
  }
  out.push(current)
  return out.join('\r\n ')
}

export const buildIcs = (
  entries: IcsEntry[],
  { name, now = new Date() }: { name: string; now?: Date },
): string => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CILAS//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    `X-WR-TIMEZONE:${CAIRO}`,
  ]
  for (const e of entries) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`)
    if (e.start) {
      lines.push(`DTSTART:${stamp(cairoToUtc(e.date, e.start))}`)
      if (e.end) lines.push(`DTEND:${stamp(cairoToUtc(e.date, e.end))}`)
    } else {
      // A day without a time is an all-day entry: the end is the next day.
      lines.push(
        `DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`,
        `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`,
      )
    }
    lines.push(`SUMMARY:${text(e.title)}`)
    if (e.location) lines.push(`LOCATION:${text(e.location)}`)
    if (e.description) lines.push(`DESCRIPTION:${text(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    if (e.cancelled) lines.push('STATUS:CANCELLED')
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
