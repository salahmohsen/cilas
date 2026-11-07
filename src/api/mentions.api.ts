import { relId } from '@/lib/relation'
import type { Payload } from 'payload'

import type { Locale, Reader } from '@/api/articles.api'
import { MENTION_TYPES, type MentionType } from '@/blocks/mention'
import { pathOf } from '@/lib/paths'
import { plainText } from '@/lib/plaintext'
import { walkEditorNodes } from '@/lib/rich-text-references'
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

type MentionFields = { id?: string; blockType?: string; type?: MentionType } & Partial<
  Record<MentionType, unknown>
>

const idOf = (v: unknown): number | null =>
  typeof v === 'string' ? null : ((relId(v) as number | null | undefined) ?? null)

/** Every mention in a Lexical body, at any depth. */
const mentionsIn = (node: unknown, found: MentionFields[] = []): MentionFields[] => {
  walkEditorNodes(node, (n) => {
    if (n.type === 'inlineBlock' && n.fields?.blockType === 'mention')
      found.push(n.fields as MentionFields)
  })
  return found
}

const imageOf = (m: unknown) => {
  const media = m as Media | null
  if (!media || typeof media !== 'object') return null
  return media.sizes?.thumbnail?.url ?? media.url ?? null
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
            timeZone: 'Africa/Cairo',
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
            href: `/study/bridge/${p.slug.replace(/^bridge-programme-/, '')}`,
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

/**
 * The mentions of an article's text, each as a link and a preview, read as
 * this reader may: a mention of something they cannot open (a draft, a
 * members-only course, a hidden person) stays plain text. Keyed by block id.
 */
export const resolveMentions = async (
  payload: Payload,
  body: unknown,
  { locale, user }: { locale: Locale; user: Reader },
): Promise<Record<string, ResolvedMention>> => {
  const mentions = mentionsIn(body)
  if (!mentions.length) return {}
  const read = {
    locale,
    fallbackLocale: (locale === 'ar' ? 'en' : 'ar') as Locale,
    overrideAccess: false,
    user,
  }
  const out: Record<string, ResolvedMention> = {}
  for (const { value, relationTo } of MENTION_TYPES) {
    const wanted = mentions.filter((m) => m.type === value && m.id && idOf(m[value]) !== null)
    if (!wanted.length) continue
    const ids = [...new Set(wanted.map((m) => idOf(m[value])!))]
    // Drafts never: the published version, as visitors read it.
    const { docs } = await payload.find({
      collection: relationTo,
      where: { id: { in: ids } },
      depth: 1,
      pagination: false,
      draft: false,
      ...read,
    })
    for (const m of wanted) {
      const doc = docs.find((d) => d.id === idOf(m[value]))
      const statusOk = !doc || !('_status' in doc) || doc._status === 'published'
      const visible = !doc || !('visible' in doc) || doc.visible !== false
      const resolved =
        doc && statusOk && visible
          ? resolveMentionDocument(value, doc as unknown as Record<string, unknown>)
          : null
      if (resolved) out[m.id!] = resolved
    }
  }
  return out
}
