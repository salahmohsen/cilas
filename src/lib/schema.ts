/**
 * Structured data (schema.org JSON-LD) for pages that describe one thing:
 * the institute itself, a person, an article, a course, an event. Each page
 * embeds what it deseribes as a `Schema` script (src/components/schema.tsx),
 * so search engines can show rich results. The data comes from the fields
 * callers already hold — nothing here queries the database.
 */

import { env } from '@/env'
import { CAIRO, cairoDay } from '@/lib/cairo-day'
import { pathOf } from '@/lib/paths'
import { plainText } from '@/lib/plaintext'
import { expandSchedule } from '@/lib/schedule'
import type { Article, Course, Event, Person } from '@/payload-types'

const CONTEXT = 'https://schema.org'

/** The header and footer's logo, as the institute's own on every schema. */
const LOGO = '/assets/images/logo.webp'

/** A relative path on the site as its absolute URL; a full URL passes through. */
export const absoluteUrl = (path: string): string =>
  new URL(path, env.NEXT_PUBLIC_SERVER_URL).toString()

/** Rich text as one line: description without the line breaks and indents. */
const plainOf = (data: unknown): string =>
  data ? plainText({ data: data as { root: unknown } }).replace(/\s+/g, ' ').trim() : ''

/**
 * A Cairo wall-clock time as an absolute instant (`2026-03-07T19:00:00+02:00`).
 * Egypt's offset moves with daylight saving, so it is read off the calendar:
 * the instant Cairo places at that wall-clock, in the spirit of ADR 0002.
 */
const isoOf = (day: string, time: string): string => {
  const hhmm = time.length > 5 ? time.slice(0, 5) : time
  const guess = new Date(`${day}T${hhmm}:00Z`)
  if (Number.isNaN(guess.getTime())) return `${day}T${hhmm}:00`

  const at = (type: string) => cairoClock.formatToParts(guess).find((p) => p.type === type)?.value
  const re = new Date(`${at('year')}-${at('month')}-${at('day')}T${at('hour')}:${at('minute')}:00Z`)
  const minutes = Math.round((re.getTime() - guess.getTime()) / 60000)
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  return `${day}T${hhmm}:00${offset}`
}

// Cairo's clock, as year, month, day and hours 0–23.
const cairoClock = new Intl.DateTimeFormat('en-US', {
  timeZone: CAIRO,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** A person as other data refers to them; a profile page's URL when it has one. */
const personRef = (person: Person, locale: string) => {
  const page = pathOf('people', person, locale)
  return {
    '@type': 'Person',
    name: person.name,
    ...(page ? { url: absoluteUrl(page) } : {}),
  }
}

export const organizationSchema = ({
  siteName,
  description,
  location,
  sameAs,
}: {
  siteName: string
  description: string
  /** The address the footer shows, when the current place has one. */
  location?: { address: string; mapUrl: string | null }
  /** The institute's social accounts. */
  sameAs: string[]
}) => ({
  '@context': CONTEXT,
  '@type': 'EducationalOrganization',
  name: siteName,
  description,
  url: absoluteUrl('/'),
  logo: absoluteUrl(LOGO),
  ...(sameAs.length ? { sameAs } : {}),
  ...(location && location.address
    ? {
        address: {
          '@type': 'PostalAddress',
          streetAddress: location.address,
          addressCountry: 'EG',
        },
        ...(location.mapUrl ? { hasMap: location.mapUrl } : {}),
      }
    : {}),
})

/** A stored date or timestamp as an ISO 8601 instant; null when it is no date. */
const stamp = (value: string | null | undefined): string | undefined => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

/** The site itself, for the sticky site name in search results. */
export const websiteSchema = ({ siteName, locale }: { siteName: string; locale: string }) => ({
  '@context': CONTEXT,
  '@type': 'WebSite',
  name: siteName,
  url: absoluteUrl('/'),
  inLanguage: locale,
})

/** Where the page sits in the site: home, the section that lists it, it. */
export const breadcrumbSchema = (crumbs: { name: string; path?: string | null }[]) => ({
  '@context': CONTEXT,
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    ...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
  })),
})

/** A page that links out to items (the course list): each entry, in its order. */
export const itemListSchema = (urls: string[]) =>
  urls.length < 3
    ? null // A carousel needs at least three courses to list.
    : {
        '@context': CONTEXT,
        '@type': 'ItemList',
        itemListElement: urls.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url })),
      }

/**
 * An article as its reading page shows it: its writers and cover, and the
 * date it was published (the editor's date, else the day Payload created it).
 */
export const articleSchema = ({
  article,
  locale,
  inLanguage,
  title,
  description,
  image,
  authors,
  publisherName,
}: {
  article: Article
  /** The URL's language; `inLanguage` is what the text itself is in. */
  locale: string
  inLanguage: string
  title: string
  description: string
  image: string | null
  authors: Person[]
  publisherName: string
}) => {
  const page = pathOf('articles', article, locale)
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    headline: title,
    description,
    inLanguage,
    datePublished: stamp(article.published_date) ?? stamp(article.createdAt),
    dateModified: stamp(article.updatedAt),
    ...(image ? { image: [image] } : {}),
    ...(authors.length ? { author: authors.map((p) => personRef(p, locale)) } : {}),
    ...(page ? { mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(page) } } : {}),
    publisher: {
      '@type': 'Organization',
      name: publisherName,
      logo: { '@type': 'ImageObject', url: absoluteUrl(LOGO) },
    },
  }
}

/** A person's profile page: the Person is what the page is about. */
export const personSchema = ({ person, locale }: { person: Person; locale: string }) => {
  const bio = plainOf(person.bio)
  const photoUrl =
    typeof person.photo === 'object' && person.photo?.url ? person.photo.url : null
  const sameAs = [person.website, ...(person.social_links ?? []).map((s) => s.url)].filter(
    (link): link is string => Boolean(link),
  )
  const page = pathOf('people', person, locale)
  return {
    '@context': CONTEXT,
    '@type': 'ProfilePage',
    dateModified: stamp(person.updatedAt),
    dateCreated: stamp(person.createdAt),
    mainEntity: {
      '@type': 'Person',
      name: person.name,
      ...(page ? { url: absoluteUrl(page) } : {}),
      ...(bio ? { description: bio } : {}),
      ...(photoUrl ? { image: absoluteUrl(photoUrl) } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  }
}

/**
 * An event (an event has no detail page: the calendar is its record). Its
 * times are the first and last meetings; without a weekly schedule, the
 * start day and the agenda's first and last hours instead. `null` when no
 * single day is known, or there is nowhere for it to happen — such an event
 * gives a search engine nothing to show.
 */
export const eventSchema = ({
  event,
  locale,
  siteName,
}: {
  event: Pick<
    Event,
    | 'title'
    | 'description'
    | 'schedule'
    | 'place'
    | 'external_venue'
    | 'online_url'
    | 'agenda'
    | 'speakers'
    | 'pricing'
    | 'registration'
  >
  locale: string
  siteName: string
}) => {
  const place = event.place && typeof event.place === 'object' ? event.place : null
  const venue = place
    ? { name: place.name, address: place.address, mapUrl: place.map_url }
    : event.external_venue?.name
      ? {
          name: event.external_venue.name,
          address: event.external_venue.address,
          mapUrl: event.external_venue.map_url,
        }
      : null
  const online = event.online_url
  if (!(venue || online)) return null

  const meetings = expandSchedule(event.schedule).filter((m) => !m.cancelled)
  const first = meetings[0]
  const last = meetings.at(-1) ?? first ?? null
  const exact =
    first && last
      ? { startDate: isoOf(first.date, first.start_time), endDate: isoOf(last.date, last.end_time) }
      : null
  // No weekly times: the day it starts, running the agenda's hours when the
  // agenda has times, else the bare day (Google wants no made-up midnight).
  const day =
    !first && event.schedule?.start_precision !== 'week' && event.schedule?.start_date
      ? cairoDay(event.schedule.start_date)
      : null
  const agendaOpen = event.agenda?.[0]?.start_time
  const agendaClose = event.agenda?.at(-1)?.end_time
  const times = exact ??
    (day
      ? agendaOpen && agendaClose
        ? { startDate: isoOf(day, agendaOpen), endDate: isoOf(day, agendaClose) }
        : { startDate: day, endDate: day }
      : null)
  if (!times) return null

  // The price when it is set (0 is free), and the form to register elsewhere.
  const price = typeof event.pricing?.min === 'number' ? event.pricing.min : null

  const speakers = (event.speakers ?? [])
    .flatMap((s) => (typeof s.person === 'object' ? [s.person] : []))
    .map((p) => personRef(p, locale))

  return {
    '@context': CONTEXT,
    '@type': 'Event',
    name: event.title,
    ...(event.description?.root?.children?.length
      ? { description: plainOf(event.description) }
      : {}),
    // Both a room and a link is hybrid; only a link is online.
    eventAttendanceMode: online
      ? venue
        ? 'MixedEventAttendanceMode'
        : 'OnlineEventAttendanceMode'
      : 'OfflineEventAttendanceMode',
    location: [
      ...(venue
        ? [
            {
              '@type': 'Place',
              name: venue.name,
              ...(venue.address
                ? {
                    address: {
                      '@type': 'PostalAddress',
                      streetAddress: venue.address,
                      addressCountry: 'EG',
                    },
                  }
                : {}),
              ...(venue.mapUrl ? { hasMap: venue.mapUrl } : {}),
            },
          ]
        : []),
      ...(online ? [{ '@type': 'VirtualLocation', url: online }] : []),
    ],
    ...times,
    ...(speakers.length ? { performer: speakers } : {}),
    ...(price !== null
      ? {
          offers: {
            '@type': 'Offer',
            price,
            priceCurrency: event.pricing?.currency ?? 'EGP',
            ...(event.registration?.url ? { url: absoluteUrl(event.registration.url) } : {}),
          },
        }
      : {}),
    organizer: { '@type': 'EducationalOrganization', name: siteName, url: absoluteUrl('/') },
  }
}

/**
 * A course, for Google's course-info results. Each instance says where it
 * happens (the `location` field) and, when it runs to a weekly pattern, how
 * often it meets. `null` when the course has no text at all to describe it.
 */
export const courseSchema = ({
  course,
  locale,
  siteName,
  instructors,
}: {
  course: Course
  locale: string
  siteName: string
  instructors: Person[]
}) => {
  const description = (
    course.meta?.description ??
    course.summary ??
    course.subtitle ??
    ''
  )
    .trim() ||
    plainOf(course.description)
  if (!description) return null

  const uses = course.location ?? []
  const hybrid =
    uses.includes('HYBRID') || (uses.includes('ONLINE') && uses.includes('OFFLINE'))
  const courseMode = hybrid
    ? 'Hybrid'
    : uses.includes('ONLINE')
      ? 'Online'
      : 'Onsite' // A course with no locations named is taught in person, as they all are.
  const slots = course.schedule?.slots?.length ?? 0

  return {
    '@context': CONTEXT,
    '@type': 'Course',
    name: course.title,
    description,
    inLanguage: locale,
    provider: { '@type': 'EducationalOrganization', name: siteName, url: absoluteUrl('/') },
    ...(instructors.length ? { instructor: instructors.map((p) => personRef(p, locale)) } : {}),
    hasCourseInstance: [
      {
        courseMode,
        ...(slots ? { courseSchedule: `${slots} times per week` } : {}),
      },
    ],
  }
}
