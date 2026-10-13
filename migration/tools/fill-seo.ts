/**
 * Fills every SEO document's meta (title, description, OG image) where it is
 * empty, in both locales; meta an editor wrote is kept. Text comes from the
 * document's own fields (src/lib/seo.ts), falling back to its longer text;
 * a locale with no text of its own takes the other's. The image is the
 * document's own; else, for a cycle, a cover among its courses; for press,
 * the outlet's logo; for an event, its course's or programme's cover; else
 * the site's default OG image, uploaded to media once.
 *
 *   npx tsx --env-file=.env migration/tools/fill-seo.ts [--dry]
 */
import path from 'node:path'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { getPayload, type CollectionSlug, type Payload } from 'payload'

import { SEO_COLLECTIONS, seoDefaults, type SeoCollection } from '../../src/lib/seo'

const dry = process.argv.includes('--dry')
const MAX = 160
const DEFAULT_OG = path.join(import.meta.dirname, '..', '..', 'public', 'assets', 'images', 'og-default.jpg')
const DEFAULT_KEY = 'site/og-default.jpg'

type Doc = Record<string, unknown> & { id: number; meta?: { title?: string | null; description?: string | null; image?: unknown } | null }
type Locale = 'en' | 'ar'

const clip = (text: string): string => {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= MAX) return flat
  const cut = flat.slice(0, MAX - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`
}
const plain = (v: unknown): string => {
  if (!v) return ''
  if (typeof v === 'string') return v
  try {
    return convertLexicalToPlaintext({ data: v as SerializedEditorState })
  } catch {
    return ''
  }
}
const idOf = (v: unknown): number | undefined =>
  typeof v === 'number' ? v : v && typeof v === 'object' && 'id' in v ? (v as { id: number }).id : undefined

/** Longer text each collection can describe itself with, after seo.ts's sources. */
const LONG: Partial<Record<SeoCollection, string[]>> = {
  courses: ['description', 'epigraph'],
  programmes: ['overview'],
  publications: ['intro'],
  events: ['description'],
  press: ['title'],
}

const defaultImage = async (payload: Payload): Promise<number> => {
  const found = (await payload.find({ collection: 'media', where: { legacy_url: { equals: DEFAULT_KEY } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]
  if (found) return found.id as number
  if (dry) return -1
  const doc = await payload.create({
    collection: 'media',
    data: { alt: 'The CILAS classroom', legacy_url: DEFAULT_KEY },
    filePath: DEFAULT_OG,
    overrideAccess: true,
  })
  return doc.id as number
}

const imageFor = async (payload: Payload, collection: SeoCollection, doc: Doc, fallback: number): Promise<number> => {
  const own = seoDefaults(collection, doc).image
  if (own !== undefined) return Number(own)
  if (collection === 'cycles') {
    const { docs } = await payload.find({ collection: 'courses', where: { and: [{ cycle: { equals: doc.id } }, { cover_image: { exists: true } }] }, limit: 1, depth: 0, overrideAccess: true })
    const cover = idOf((docs[0] as unknown as Doc | undefined)?.cover_image)
    if (cover) return cover
  }
  if (collection === 'press') {
    const logo = idOf((doc.outlet as { logo?: unknown } | null | undefined)?.logo)
    if (logo) return logo
  }
  if (collection === 'events') {
    for (const [rel, field] of [['courses', 'cover_image'], ['programmes', 'cover']] as const) {
      const id = idOf(doc[rel === 'courses' ? 'course' : 'programme'])
      if (!id) continue
      const linked = (await payload.findByID({ collection: rel, id, depth: 0, draft: true, overrideAccess: true })) as unknown as Doc
      const img = idOf(linked[field])
      if (img) return img
    }
  }
  return fallback
}

const textFor = (collection: SeoCollection, doc: Doc): { title?: string; description?: string } => {
  const base = seoDefaults(collection, doc)
  let description = base.description
  if (!description) {
    for (const f of LONG[collection] ?? []) {
      const t = plain(doc[f]).trim()
      if (t) {
        description = clip(t)
        break
      }
    }
  }
  return { title: base.title, description }
}

const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
const fallback = await defaultImage(payload)
const drafts = (c: CollectionSlug) => Boolean(payload.collections[c]?.config.versions?.drafts)

for (const collection of SEO_COLLECTIONS) {
  const { docs } = await payload.find({ collection, limit: 2000, pagination: false, depth: 0, draft: drafts(collection), locale: 'en', fallbackLocale: false, overrideAccess: true })
  let filled = 0
  for (const enDoc of docs as unknown as Doc[]) {
    const arDoc = (await payload.findByID({ collection, id: enDoc.id, depth: 0, draft: drafts(collection), locale: 'ar', fallbackLocale: false, overrideAccess: true })) as unknown as Doc
    const image = await imageFor(payload, collection, enDoc, fallback)
    const texts = { en: textFor(collection, enDoc), ar: textFor(collection, arDoc) }
    let touched = false
    for (const locale of ['en', 'ar'] as Locale[]) {
      const doc = locale === 'en' ? enDoc : arDoc
      const other = locale === 'en' ? texts.ar : texts.en
      const meta = doc.meta ?? {}
      const data: Record<string, unknown> = {}
      const title = texts[locale].title ?? other.title
      const description = texts[locale].description ?? other.description
      if (!meta.title && title) data.title = title
      if (!meta.description && description) data.description = description
      if (!idOf(meta.image) && image > 0) data.image = image
      if (!Object.keys(data).length) continue
      touched = true
      if (dry) continue
      // A locale without its own title fails the required title on save.
      // Versioned collections write a draft (drafts skip required fields) and
      // publish it below; the rest take the English title, as the site's
      // fallback already shows it.
      const titleless = locale === 'ar' && !arDoc.title
      await payload.update({
        collection,
        id: enDoc.id,
        locale,
        data: {
          meta: { ...meta, image: idOf(meta.image) ?? null, ...data },
          ...(titleless && !drafts(collection) ? { title: enDoc.title } : {}),
        },
        overrideAccess: true,
        ...(drafts(collection) ? { draft: true } : {}),
      } as Parameters<Payload['update']>[0])
    }
    // The drafts above become the published version, as they were before.
    if (touched && !dry && drafts(collection) && enDoc._status === 'published') {
      await payload.update({ collection, id: enDoc.id, data: { _status: 'published' }, overrideAccess: true } as Parameters<Payload['update']>[0])
    }
    if (touched) filled++
  }
  console.log(`${collection}: ${filled}/${docs.length} filled${dry ? ' (dry run)' : ''}`)
}
await payload.destroy()
process.exit(0)
