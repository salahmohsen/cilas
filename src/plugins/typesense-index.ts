import type { CollectionConfig, Config } from 'payload'
import { Client } from 'typesense'

import { env } from '@/env'
import {
  TYPESENSE_SEARCH_COLLECTIONS,
  typesenseCollectionName,
  type SearchCollectionSlug,
} from '@/lib/search-config'

/**
 * Own Typesense indexer for the search-panel collections, in both site
 * languages. The older Rubix plugin still indexes the rest of the site
 * into bare slugs; here the panel's `courses`, `articles` and `people`
 * get one collection per language (`courses`, `courses-ar`, …) with an
 * extra `owner` field resolved from the related People docs, so rows can
 * carry their author like the Arc search-results block.
 *
 * Startup repairs the schema when it predates a field (an index without
 * `owner`, for example) by dropping and rebuilding the mirror, then
 * pulling the whole locale in. Saves upsert; deletes remove.
 */

type SearchDoc = {
  id: string
  slug: string
  createdAt: number
  updatedAt: number
  owner: string
  [field: string]: number | string
}

/** The media document's public URL, when the relation resolved deeply. */
const mediaUrl = (relation: unknown): string => {
  const url = (relation as { url?: unknown } | undefined)?.url
  return typeof url === 'string' && url ? url : ''
}

/** Cover art for the row: the course/article cover, a person's own photo. */
const coverImageOf = (doc: Record<string, unknown>, slug: SearchCollectionSlug): string => {
  const relation = slug === 'people' ? doc.photo : doc.cover_image
  return mediaUrl(relation)
}

/** First related author's photo, for the author line. */
const ownerPhotoOf = (doc: Record<string, unknown>, slug: SearchCollectionSlug): string => {
  const source = slug === 'courses' ? doc.fellows : slug === 'articles' ? doc.authors : undefined
  const first = Array.isArray(source) ? source[0] : undefined
  return mediaUrl(first)
}

/** Related People docs resolved at sync time; ids fall back to ''. */
const ownerOf = (doc: Record<string, unknown>, slug: SearchCollectionSlug): string => {
  const source =
    slug === 'courses' ? doc.fellows : slug === 'articles' ? doc.authors : undefined
  if (source == null) return ''
  const entries = Array.isArray(source) ? source : []
  return entries
    .map((entry) => {
      const name = (entry as Record<string, unknown> | undefined)?.name
      return typeof name === 'string' ? name.trim() : ''
    })
    .filter(Boolean)
    .join(', ')
}

/** Lexical richText content flattens; textarea and arrays stay plain. */
const flatten = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join('\n')
  if (typeof value === 'object' && 'root' in (value as Record<string, unknown>))
    return extractLexical(value)
  return ''
}

/** The whole course syllabus as one searchable blob: session titles,
 * descriptions, activities and every bibliography entry, deduplicated in
 * reading order so the index follows the page. */
const syllabusText = (doc: Record<string, unknown>): string => {
  const lines: string[] = []
  const push = (value: unknown) => {
    for (const line of flatten(value).split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !lines.includes(trimmed)) lines.push(trimmed)
    }
  }
  const sessions = Array.isArray(doc.sessions) ? doc.sessions : []
  for (const session of sessions as Record<string, unknown>[]) {
    push(session.session_title)
    push(session.description)
    const activities = Array.isArray(session.activities) ? session.activities : []
    for (const activity of activities as Record<string, unknown>[]) {
      push(activity.description)
    }
    const bibliography = Array.isArray(session.bibliography) ? session.bibliography : []
    for (const entry of bibliography as Record<string, unknown>[]) {
      push(entry.title)
      push(entry.note)
    }
  }
  const courseBibliography = Array.isArray(doc.bibliography) ? doc.bibliography : []
  for (const entry of courseBibliography as Record<string, unknown>[]) {
    push(entry.title)
    push(entry.note)
  }
  return lines.join('\n')
}

const extractLexical = (richText: unknown): string => {
  const root = (richText as { root?: unknown } | null)?.root
  if (root == null) return ''
  const walk = (node: unknown): string => {
    if (node == null || typeof node === 'string') return node ?? ''
    if (typeof node !== 'object') return ''
    const record = node as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (Array.isArray(record.children)) {
      return record.children.map(walk).filter(Boolean).join(' ')
    }
    return ''
  }
  return walk(root).trim()
}

const mapDoc = (
  doc: Record<string, unknown> & { id?: number | string },
  slug: SearchCollectionSlug,
  fields: readonly string[],
): SearchDoc | null => {
  if (doc.id == null || doc.id === '') return null
  const document: SearchDoc = {
    id: String(doc.id),
    slug: doc.slug ? String(doc.slug) : '',
    createdAt: doc.createdAt ? new Date(doc.createdAt as string).getTime() : Date.now(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt as string).getTime() : Date.now(),
    owner: ownerOf(doc, slug),
    coverImage: coverImageOf(doc, slug),
    ownerPhoto: ownerPhotoOf(doc, slug),
  }
  for (const field of fields) {
    document[field] = flatten(doc[field])
  }
  // The derived syllabus blob for courses, not a Payload field of its own.
  if ('syllabus' in document) {
    document.syllabus = syllabusText(doc)
  }
  return document
}

/** The base fields every mirror carries, before the searchable ones. */
const baseSchema = () => [
  { name: 'slug', type: 'string' as const },
  { name: 'createdAt', type: 'int64' as const },
  { name: 'updatedAt', type: 'int64' as const },
  // Not searched: the query_by only covers the content fields.
  { name: 'owner', type: 'string' as const },
  { name: 'coverImage', type: 'string' as const, optional: true },
  { name: 'ownerPhoto', type: 'string' as const, optional: true },
]

const buildSchema = (name: string, fields: readonly string[]) => ({
  name,
  fields: [...baseSchema(), ...fields.map((field) => ({ name: field, type: 'string' as const }))],
})

/** Collections the panel reads; extend when a new public page lands. */
const PANEL_SLUGS = new Set<SearchCollectionSlug>(['courses', 'articles', 'people'])

export const typesensePanelIndex = () => (incoming: Config): Config => {
  // next build runs the payload config too, where `typesense` (the
  // compose-network hostname) resolves nowhere: the indexer only serves
  // runtime, so it disconnects itself on the build phase.
  if (!env.TYPESENSE_API_KEY || process.env.NEXT_PHASE === 'phase-production-build') return incoming

  const client = new Client({
    apiKey: env.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 5,
    nodes: [
      {
        host: env.TYPESENSE_HOST,
        port: env.TYPESENSE_PORT,
        protocol: env.TYPESENSE_PROTOCOL,
      },
    ],
  })

  const upsert = async (name: string, document: SearchDoc): Promise<void> => {
    try {
      await client.collections(name).documents().upsert(document)
    } catch (error) {
      console.error(`[typesense] failed to index ${name}/${document.id}`, error)
    }
  }

  const remove = async (name: string, id: string): Promise<void> => {
    try {
      await client.collections(name).documents(id).delete()
    } catch (error) {
      const status = (error as { httpStatus?: number }).httpStatus
      if (status !== 404) console.error(`[typesense] failed to remove ${name}/${id}`, error)
    }
  }

  /** Ensures the mirror exists and its schema carries every mapped field. */
  const ensureSchema = async (name: string, fields: readonly string[]): Promise<void> => {
    try {
      const existing = await client.collections(name).retrieve()
      const known = new Set((existing.fields ?? []).map((field) => field.name))
      const missing = fields.filter((field) => !known.has(field))
      if (!missing.length && known.has('owner') && known.has('coverImage') && known.has('ownerPhoto')) return
      // A schema that predates a field can only grow through a rebuild.
      await client.collections(name).delete()
      console.log(
        `[typesense] rebuilt ${name}, schema missed: ${missing.join(', ') || 'owner'}`,
      )
    } catch (error) {
      const status = (error as { httpStatus?: number }).httpStatus
      if (status !== 404) {
        console.error(`[typesense] failed to inspect ${name}`, error)
        throw error
      }
    }
    try {
      const created = await client.collections().create(buildSchema(name, fields))
      console.log(
        `[typesense] created ${name} fields:`,
        (created.fields ?? []).map((f) => f.name).join(','),
      )
    } catch (error) {
      const status = (error as { httpStatus?: number }).httpStatus
      if (status !== 409) throw error
    }
  }

  const syncLocale = async (
    slug: SearchCollectionSlug,
    locale: 'en' | 'ar',
    payload: {
      find: (options: Record<string, unknown>) => Promise<{
        docs: (Record<string, unknown> & { id?: number | string })[]
        hasNextPage: boolean
      }>
    },
  ): Promise<void> => {
    const fields = TYPESENSE_SEARCH_COLLECTIONS[slug].searchFields
    const name = typesenseCollectionName(slug, locale)
    await ensureSchema(name, fields)
    let page = 1
    let hasMore = true
    let indexed = 0
    while (hasMore) {
      const { docs, hasNextPage } = await payload.find({
        collection: slug,
        locale,
        fallbackLocale: false,
        depth: 1,
        limit: 500,
        page,
      })
      const mapped = docs.map((doc) => mapDoc(doc, slug, fields)).filter((doc) => doc != null)
      if (mapped.length) {
        await client.collections(name).documents().import(mapped, { action: 'upsert' })
        indexed += mapped.length
      }
      hasMore = hasNextPage
      page += 1
    }
    console.log(`[typesense] ${name}: ${indexed} documents indexed`)
  }

  const collections = incoming.collections?.map(
    (collection: CollectionConfig): CollectionConfig => {
      const { slug } = collection
      if (!PANEL_SLUGS.has(slug as SearchCollectionSlug)) return collection
      const fields = TYPESENSE_SEARCH_COLLECTIONS[slug as SearchCollectionSlug].searchFields

      // Localized writes carry `req.locale`; when it is unset the save
      // used the default locale. Either way, the doc lands in exactly
      // one mirror — this is the anti-mixing rule the Rubix plugin
      // could not hold.
      const localeOf = (req?: { locale?: string }): 'en' | 'ar' =>
        req?.locale === 'ar' ? 'ar' : 'en'

      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          afterChange: [
            ...(collection.hooks?.afterChange ?? []),
            (args: {
              doc: Record<string, unknown>
              req?: { locale?: string }
            }) => {
              const doc = mapDoc(args.doc, slug as SearchCollectionSlug, fields)
              if (doc) void upsert(typesenseCollectionName(slug, localeOf(args.req)), doc)
            },
          ],
          afterDelete: [
            ...(collection.hooks?.afterDelete ?? []),
            (args: { doc?: { id?: number | string | null } }) => {
              if (args.doc?.id == null) return
              void remove(typesenseCollectionName(slug, 'en'), String(args.doc.id))
              void remove(typesenseCollectionName(slug, 'ar'), String(args.doc.id))
            },
          ],
        },
      }
    },
  )

  const initialize = async (payload: unknown): Promise<void> => {
    const api = payload as {
      find: Record<string, unknown>
      collections?: Record<string, unknown>
    }
    for (const slug of Object.keys(TYPESENSE_SEARCH_COLLECTIONS) as SearchCollectionSlug[]) {
      if (!PANEL_SLUGS.has(slug) || !api.collections?.[slug]) continue
      for (const locale of ['en', 'ar'] as const) {
        try {
          await syncLocale(
            slug,
            locale,
            payload as Parameters<typeof syncLocale>[2],
          )
        } catch (error) {
          console.error(`[typesense] failed to sync ${slug} (${locale})`, error)
        }
      }
    }
  }

  return {
    ...incoming,
    collections,
    onInit: async (payload) => {
      await incoming.onInit?.(payload)
      await initialize(payload)
    },
  }
}
