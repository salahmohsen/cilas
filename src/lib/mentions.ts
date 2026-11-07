import type { MentionType } from '@/blocks/mention'
import { CAIRO } from '@/lib/cairo-day'
import { mediaThumbnail } from '@/lib/media-image'
import { bridgeYearPath, pathOf } from '@/lib/paths'

import { plainText } from '@/lib/plaintext'
import type { Article, Course, Event, Media, Person, Programme, Publication } from '@/payload-types'

/** What a mention's hover card shows. */
export type MentionPreview = {
  kind: MentionType
  title: string
  /** A line under the title: who, when or where. */
  meta: string | null
  text: string | null
  image: string | null
}

/** A mention that leads somewhere: its link and its preview. */
export type ResolvedMention = { href: string; preview: MentionPreview }

const imageOf = (m: unknown) => {
  const media = m as Media | null
  if (!media || typeof media !== 'object') return null
  return mediaThumbnail(media) ?? null
}
const names = (people: unknown) =>
  ((people as Array<Person | number> | null | undefined) ?? [])
    .flatMap((p) => (typeof p === 'object' && p?.name ? [p.name] : []))
    .join(', ') || null
const short = (text: string | null | undefined, max = 180) => {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max).replace(/\s+\S*$/, '')}…` : t || null
}
const plain = (rich: unknown) => (rich ? short(plainText({ data: rich as never })) : null)

/** A mentioned document as a link and a preview, or null when it has no public page. */
export const resolveMentionDocument = (
  kind: MentionType,
  doc: Record<string, unknown>,
): ResolvedMention | null => {
  switch (kind) {
    case 'person': {
      const p = doc as unknown as Person
      const path = pathOf('people', p)
      return path
        ? {
            href: path,
            preview: {
              kind,
              title: p.name,
              meta: null,
              text: plain(p.bio),
              image: imageOf(p.photo),
            },
          }
        : null
    }
    case 'article': {
      const a = doc as unknown as Article
      const path = pathOf('articles', a)
      return path
        ? {
            href: path,
            preview: {
              kind,
              title: a.title,
              meta: names(a.authors),
              text: plain(a.body),
              image: imageOf(a.cover_image),
            },
          }
        : null
    }
    case 'course': {
      const c = doc as unknown as Course
      const path = pathOf('courses', c)
      const cycle = typeof c.cycle === 'object' && c.cycle ? c.cycle.title : null
      return path
        ? {
            href: path,
            preview: {
              kind,
              title: c.title,
              meta: [names(c.fellows), cycle].filter(Boolean).join(' · ') || null,
              text: short(c.summary || c.subtitle) || plain(c.description),
              image: imageOf(c.cover_image),
            },
          }
        : null
    }
    case 'event': {
      const e = doc as unknown as Event
      const day = e.schedule?.start_date
        ? new Date(e.schedule.start_date).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: CAIRO,
          })
        : null
      const href = pathOf('events', e)
      return href
        ? {
            href,
            preview: {
              kind,
              title: e.title,
              meta: day,
              text: plain(e.description),
              image: imageOf(e.cover_image),
            },
          }
        : null
    }
    case 'publication': {
      const p = doc as unknown as Publication
      return p.slug
        ? {
            href: `/articles?publication=${encodeURIComponent(p.slug)}`,
            preview: {
              kind,
              title: p.title,
              meta: names(p.editors),
              text: short(p.subtitle) || plain(p.intro),
              image: imageOf(p.cover_image),
            },
          }
        : null
    }
    case 'programme': {
      const p = doc as unknown as Programme
      // Only the Bridge has a page of its own.
      return p.kind === 'bridge' && p.slug
        ? {
            href: bridgeYearPath(p.slug),
            preview: {
              kind,
              title: p.title,
              meta: null,
              text: short(p.tagline) || plain(p.overview),
              image: imageOf(p.cover),
            },
          }
        : null
    }
  }
}
