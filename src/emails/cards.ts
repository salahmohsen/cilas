import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

import { pathOf } from '@/lib/paths'

/** One newsletter pick as the email shows it. */
export type Card = {
  kind: 'Course' | 'Article' | 'Collection' | 'Cycle' | 'Programme' | 'Event'
  title: string
  /** "by" whom: a course's fellows, a collection's editors. */
  byline: string | null
  meta: string | null
  text: string | null
  note: string | null
  image: { url: string; alt: string } | null
  /** A cycle's courses, each a full card. */
  children: Card[]
  url: string
  button: string
}

export type PickRelation = 'courses' | 'articles' | 'publications' | 'cycles' | 'programmes' | 'events'
type Pick = { relationTo: PickRelation; value: unknown }
type Doc = Record<string, unknown> & { id: number; title?: string; slug?: string | null }

const imageOf = (media: unknown, alt: string) => {
  const m = media as { url?: string | null; alt?: string | null } | null
  return m && typeof m === 'object' && m.url?.startsWith('http') ? { url: m.url, alt: m.alt || alt } : null
}

const SEASONS: Record<string, string> = { fall: 'Fall', winter: 'Winter', spring: 'Spring', summer: 'Summer' }

const cycleLabel = (cycle: unknown) => {
  const c = cycle as { season?: string; start_year?: number } | null
  return c && typeof c === 'object' && c.season ? `${SEASONS[c.season] ?? c.season} ${c.start_year ?? ''}`.trim() : null
}

/** "A", "A and B", "A, B and C" from populated people. */
const namesOf = (people: unknown): string | null => {
  const names = ((people as Array<{ name?: string } | number> | null | undefined) ?? [])
    .map((p) => (typeof p === 'object' ? p?.name : null))
    .filter((n): n is string => Boolean(n))
  if (!names.length) return null
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

/** The start of a rich text, for a card. */
const excerpt = (body: unknown, length = 180) => {
  if (!body || typeof body !== 'object') return null
  const text = convertLexicalToPlaintext({ data: body as never }).replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text || null
}

const isPublic = (doc: Record<string, unknown>) =>
  doc._status === 'published' && (doc.tier === undefined || doc.tier === 'public')

/** "Thursday 24 July 2026, 14:00–18:30": an event's first day and time, Cairo time. */
const whenOf = (schedule: unknown) => {
  const s = schedule as { start_date?: string; slots?: Array<{ start_time?: string; end_time?: string }> } | null
  if (!s?.start_date) return null
  const day = new Date(s.start_date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Cairo',
  }).replace(',', '')
  const slot = s.slots?.[0]
  return slot?.start_time ? `${day}, ${slot.start_time}${slot.end_time ? `–${slot.end_time}` : ''}` : day
}

const placeOf = (doc: Doc) => {
  const space = doc.space as { name?: string } | null
  const venue = doc.external_venue as { name?: string } | null
  if (space && typeof space === 'object' && space.name) return space.name
  if (venue?.name) return venue.name
  return doc.online_url ? 'Online' : null
}

/** A populated pick as a card, or null when it is missing or has no page. */
export const cardOf = (
  pick: Pick,
  note: string | null | undefined,
  labels: { site: string; read: string; apply: string },
): Card | null => {
  const doc = pick.value as Doc | null
  if (!doc || typeof doc !== 'object' || !doc.title) return null
  const site = labels.site.replace(/\/+$/, '')
  const base = { title: doc.title, note: note?.trim() || null, byline: null, children: [], button: labels.read }

  switch (pick.relationTo) {
    case 'courses': {
      const path = pathOf('courses', doc, 'en')
      if (!path) return null
      return {
        ...base,
        kind: 'Course',
        byline: namesOf(doc.fellows),
        meta: cycleLabel(doc.cycle),
        // The description's start, as the course page opens; else its card line.
        text: excerpt(doc.description, 260) || (doc.summary as string | null) || (doc.subtitle as string | null) || null,
        image: imageOf(doc.cover_image, doc.title),
        url: `${site}${path}`,
      }
    }
    case 'articles': {
      const path = pathOf('articles', doc, 'en')
      if (!path) return null
      return {
        ...base,
        kind: 'Article',
        byline: namesOf(doc.authors),
        meta: null,
        text: excerpt(doc.body),
        image: imageOf(doc.cover_image, doc.title),
        url: `${site}${path}`,
      }
    }
    case 'publications': {
      if (!doc.slug) return null
      const count = ((doc.articles as unknown[] | null) ?? []).length
      return {
        ...base,
        kind: 'Collection',
        byline: namesOf(doc.editors),
        meta: count ? `${count} ${count === 1 ? 'text' : 'texts'}` : null,
        text: (doc.subtitle as string | null) || excerpt(doc.intro),
        image: imageOf(doc.cover_image, doc.title),
        url: `${site}/en/articles?publication=${encodeURIComponent(doc.slug)}`,
      }
    }
    case 'cycles': {
      const c = doc as Doc & { season?: string; start_year?: number }
      // The cycle's public courses, each as its own card (src/emails/issue.ts loads them).
      const courses = (((doc.courses as { docs?: unknown[] } | null)?.docs ?? []) as Doc[])
        .filter((course) => course && typeof course === 'object' && isPublic(course))
        .flatMap((course) => {
          const card = cardOf({ relationTo: 'courses', value: course }, null, labels)
          return card ? [card] : []
        })
      const query = c.season && c.start_year ? `?season=${c.season}&year=${c.start_year}` : ''
      return {
        ...base,
        kind: 'Cycle',
        meta: courses.length ? `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}` : null,
        text: null,
        image: null,
        children: courses,
        url: `${site}/en/study${query}`,
        button: 'All courses of the cycle',
      }
    }
    case 'events':
      return {
        ...base,
        kind: 'Event',
        meta: [whenOf(doc.schedule), placeOf(doc)].filter(Boolean).join(' · ') || null,
        text: excerpt(doc.description),
        image: imageOf(doc.cover_image ?? doc.cover, doc.title),
        url: `${site}/en/calendar`,
      }
    case 'programmes':
      // Only the Bridge has a page of its own (/study/bridge).
      if (doc.kind !== 'bridge') return null
      return {
        ...base,
        kind: 'Programme',
        meta: null,
        text: (doc.tagline as string | null) || null,
        image: imageOf(doc.cover, doc.title),
        url: `${site}/en/study/bridge`,
        button: labels.apply,
      }
  }
}
