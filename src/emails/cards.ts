import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

import { pathOf } from '@/lib/paths'

/** One newsletter pick as the email shows it. */
export type Card = {
  kind: 'Course' | 'Article' | 'Programme'
  title: string
  meta: string | null
  text: string | null
  note: string | null
  image: { url: string; alt: string } | null
  url: string
  button: string
}

type Pick = { relationTo: 'courses' | 'articles' | 'programmes'; value: unknown }
type Doc = Record<string, unknown> & { id: number; title?: string; slug?: string | null }

const imageOf = (media: unknown, alt: string) => {
  const m = media as { url?: string | null; alt?: string | null } | null
  return m && typeof m === 'object' && m.url?.startsWith('http') ? { url: m.url, alt: m.alt || alt } : null
}

const SEASONS: Record<string, string> = { fall: 'Fall', winter: 'Winter', spring: 'Spring', summer: 'Summer' }

/** The start of an article's body, for its card. */
const excerpt = (body: unknown, length = 180) => {
  if (!body || typeof body !== 'object') return null
  const text = convertLexicalToPlaintext({ data: body as never }).replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text || null
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
  const base = { title: doc.title, note: note?.trim() || null }

  if (pick.relationTo === 'courses') {
    const path = pathOf('courses', doc, 'en')
    if (!path) return null
    const cycle = doc.cycle as { season?: string; start_year?: number } | null
    return {
      kind: 'Course',
      ...base,
      meta:
        cycle && typeof cycle === 'object' && cycle.season
          ? `${SEASONS[cycle.season] ?? cycle.season} ${cycle.start_year ?? ''}`.trim()
          : null,
      text: (doc.summary as string | null) || (doc.subtitle as string | null) || null,
      image: imageOf(doc.cover_image, doc.title),
      url: `${site}${path}`,
      button: labels.read,
    }
  }
  if (pick.relationTo === 'articles') {
    const path = pathOf('articles', doc, 'en')
    if (!path) return null
    const authors = ((doc.authors as Array<{ name?: string } | number> | undefined) ?? [])
      .map((a) => (typeof a === 'object' ? a.name : null))
      .filter(Boolean)
    return {
      kind: 'Article',
      ...base,
      meta: authors.length ? authors.join(', ') : null,
      text: excerpt(doc.body),
      image: imageOf(doc.cover_image, doc.title),
      url: `${site}${path}`,
      button: labels.read,
    }
  }
  // Only the Bridge has a page of its own (/study/bridge).
  if (doc.kind !== 'bridge') return null
  return {
    kind: 'Programme',
    ...base,
    meta: null,
    text: (doc.tagline as string | null) || null,
    image: imageOf(doc.cover, doc.title),
    url: `${site}/en/study/bridge`,
    button: labels.apply,
  }
}
