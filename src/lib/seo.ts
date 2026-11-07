import { routing } from '@/i18n/routing'
import { plainText } from '@/lib/plaintext'
import { relId } from '@/lib/relation'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Metadata } from 'next'

/** Paths exclude the locale prefix; query strings identify distinct listing pages. */
export const pageAlternates = (path: string, locale: string): Metadata['alternates'] => ({
  canonical: `/${locale}${path}`,
  languages: {
    ...Object.fromEntries(routing.locales.map((language) => [language, `/${language}${path}`])),
    'x-default': `/${routing.defaultLocale}${path}`,
  },
})

/** Collections with SEO fields (docs/schema.md, Plugins). */
export const SEO_COLLECTIONS = [
  'courses',
  'cycles',
  'programmes',
  'publications',
  'articles',
  'events',
] as const
export type SeoCollection = (typeof SEO_COLLECTIONS)[number]

type Doc = Record<string, unknown>
type Source = { description?: string[]; richText?: string; image?: string }

// Which of a document's own fields stand in for its SEO fields.
const SOURCES: Record<SeoCollection, Source> = {
  courses: { description: ['summary', 'subtitle'], image: 'cover_image' },
  cycles: {},
  programmes: { description: ['tagline'], image: 'cover' },
  publications: { description: ['subtitle'], image: 'cover_image' },
  articles: { richText: 'body', image: 'cover_image' },
  events: { richText: 'description', image: 'cover_image' },
}

const MAX = 160

const clip = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= MAX) return flat
  const cut = flat.slice(0, MAX - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`
}

const idOf = (value: unknown) =>
  value == null ? undefined : (relId(value) as number | string | undefined)

/**
 * The SEO title, description and image a document gets from its own fields.
 * Used by the admin's Generate buttons and as the fallback when meta is empty.
 */
export const seoDefaults = (
  collection: SeoCollection,
  doc: Doc,
): { title?: string; description?: string; image?: number | string } => {
  const source = SOURCES[collection]
  const result: { title?: string; description?: string; image?: number | string } = {}

  if (typeof doc.title === 'string' && doc.title) result.title = `${doc.title} · CILAS`

  const text =
    source.description?.map((f) => doc[f]).find((v): v is string => typeof v === 'string' && !!v) ??
    (source.richText && doc[source.richText]
      ? plainText({ data: doc[source.richText] as SerializedEditorState })
      : undefined)
  if (text) result.description = clip(text)

  const image = source.image ? idOf(doc[source.image]) : undefined
  if (image !== undefined) result.image = image

  return result
}

/**
 * A page's title, description, address and share image (its own, when it
 * has one). A page with an opengraph-image.tsx passes this through
 * withShareCard, which hands the image to the card instead.
 */
export function buildPageMetadata({
  title,
  description,
  image,
  path,
  locale,
  type,
}: {
  title?: string
  description?: string | null
  image?: string | null
  path: string
  locale: string
  type?: 'article'
}): Metadata {
  return {
    title,
    description,
    alternates: pageAlternates(path, locale),
    openGraph: {
      title,
      description: description ?? undefined,
      ...(image ? { images: [{ url: image }] } : {}),
      ...(type ? { type } : {}),
    },
    twitter: { card: 'summary_large_image', ...(image ? { images: [image] } : {}) },
  }
}

/**
 * For a page whose opengraph-image.tsx draws its share card
 * (src/lib/og-card.tsx): the image goes into the card's background, not the
 * tags. Next uses the card only while the page's own metadata names no
 * images, and Twitter then takes the card too.
 */
export function withShareCard(metadata: Metadata): Metadata {
  const { images: _og, ...openGraph } = metadata.openGraph ?? {}
  const { images: _twitter, ...twitter } = metadata.twitter ?? {}
  return {
    ...metadata,
    ...(metadata.openGraph ? { openGraph } : {}),
    ...(metadata.twitter ? { twitter } : {}),
  }
}
