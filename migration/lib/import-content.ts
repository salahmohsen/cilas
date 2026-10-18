import path from 'node:path'

import type { CollectionSlug, Payload, Where } from 'payload'

import { slugify } from '../../src/lib/slugify'
import { blocksToLexical, type Block } from './blocks'
import { freeSlug } from './import-courses'
import { mediaFor } from './import-media'

type Names = { en?: string; ar?: string }
export type ArchiveCredit = { role: string; label?: Names | null; people: string[] }

export type ArchiveArticle = {
  legacy_url: string
  kind: 'essay' | 'blog'
  title_en: string
  title_ar: string | null
  match_titles_en: string[]
  blocks_en: Block[] | null
  blocks_ar: Block[] | null
  authors: string[]
  credits: ArchiveCredit[]
  translation: {
    original_language: string | null
    original_title: string | null
    original_authors: string[]
    original_source: string | null
    original_url?: string | null
  } | null
  publication: string | null
  published_date: string | null
  /** Arabic spellings, as printed, of the people this article names (Latin name → Arabic). */
  names_ar?: Record<string, string>
}

export type ArchivePublication = {
  legacy_url: string
  kind: string
  title_en: string
  title_ar: string | null
  subtitle_en: string | null
  subtitle_ar: string | null
  match_titles_en: string[]
  year_from: number | null
  year_to: number | null
  intro_en: Block[] | null
  intro_ar: Block[] | null
  foreword: string | null
  articles: string[]
  credits: ArchiveCredit[]
  funders: string[]
  license: string | null
  produced_by: string[]
  print_edition_url: string | null
}

export type ArchivePress = {
  legacy_url: string
  kind: string
  title: string
  language: string | null
  outlet: string | null
  authors: string[]
  published_date: string | null
  date_precision: string | null
  links: Array<{ language?: string | null; url: string; archived_url?: string | null }>
  excerpt: string | null
}

export type ArchiveEvent = {
  legacy_url: string
  title_en: string
  event_type: string
  tier: 'public' | 'community'
  schedule: {
    start_date?: string
    start_precision?: 'day' | 'week'
    weeks?: number
    slots: Array<{ weekday: string; start_time: string; end_time: string }>
  }
  speakers: string[]
  description_en: Block[] | null
}

export type ArchiveNewsletter = {
  legacy_url: string
  title_en: string
  issue_date: string
  blocks_en: Block[] | null
}

export type ArchiveImage = { file: string; alt: string }
/** Images an editor chose (seed/data/archive/images.json): files relative to `imagesDir`. */
export type ArchiveImages = {
  articles?: Record<string, ArchiveImage>
  publications?: Record<string, ArchiveImage>
  people?: Record<string, ArchiveImage>
}

export type ArchiveContent = {
  articles: ArchiveArticle[]
  publications: ArchivePublication[]
  press: ArchivePress[]
  events: ArchiveEvent[]
  newsletters: ArchiveNewsletter[]
  images?: ArchiveImages
  /** Where `images` files live. */
  imagesDir?: string
}

export type Tally = { created: number; updated: number; skipped: number }
export type ContentResult = Record<
  'articles' | 'publications' | 'press' | 'events' | 'newsletters' | 'people',
  Tally
>

type Row = { id: number; slug?: string | null }
type Written = { id: number; touched: boolean; doc?: Record<string, unknown> }

const IMPORT_CONTEXT = { skipReviewEmail: true }
const rich = (blocks: Block[] | null | undefined, dir: 'ltr' | 'rtl') => (blocks?.length ? blocksToLexical(blocks, dir) : null)
const titlesMatch = (titles: string[]): Where => ({ title: { in: titles } })

/**
 * Imports the archive's publishing content as drafts for review. Documents an
 * editor marked `reviewed` are never touched; everything else is replaced, so
 * running it again changes nothing but versions.
 */
export const importContent = async (payload: Payload, data: ArchiveContent): Promise<ContentResult> => {
  const tally = (): Tally => ({ created: 0, updated: 0, skipped: 0 })
  const result: ContentResult = {
    articles: tally(),
    publications: tally(),
    press: tally(),
    events: tally(),
    newsletters: tally(),
    people: tally(),
  }

  /**
   * Creates the document, or updates the match. An update keeps the slug the
   * document has (so a replaced title never moves its URL); a reviewed match
   * is returned untouched.
   */
  const put = async (
    key: keyof ContentResult,
    collection: CollectionSlug,
    where: Where,
    body: Record<string, unknown>,
    options: { draft?: boolean; createOnly?: Record<string, unknown> } = {},
  ): Promise<Written> => {
    const { docs } = await payload.find({
      collection,
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
      draft: options.draft,
    })
    const existing = docs[0] as unknown as Row | undefined
    const args = { overrideAccess: true, draft: options.draft, context: IMPORT_CONTEXT }
    if (existing) {
      const { slug: _slug, ...rest } = body
      const doc = await payload.update({
        collection,
        id: existing.id,
        data: existing.slug ? { ...rest, slug: existing.slug } : rest,
        ...args,
      } as Parameters<Payload['update']>[0])
      result[key].updated++
      return { id: existing.id, touched: true, doc: doc as unknown as Record<string, unknown> }
    }
    const slug = typeof body.slug === 'string' ? await freeSlug(payload, collection, body.slug) : undefined
    const doc = await payload.create({
      collection,
      data: { ...body, ...options.createOnly, ...(slug ? { slug } : {}) },
      ...args,
    } as Parameters<Payload['create']>[0])
    result[key].created++
    return { id: doc.id as number, touched: true, doc: doc as unknown as Record<string, unknown> }
  }

  // People, by exact name; a missing one is created, flagged for review.
  const people = new Map<string, number>()
  const arabicNamed = new Set<number>()
  /** Gives a person their Arabic name as the source prints it (never on a reviewed person). */
  const nameInArabic = async (id: number, nameAr: string | undefined) => {
    if (!nameAr || arabicNamed.has(id)) return
    arabicNamed.add(id)
    const doc = (await payload.findByID({ collection: 'people', id, locale: 'ar', fallbackLocale: false, depth: 0, overrideAccess: true })) as {
      name?: string | null
    }
    if (doc.name === nameAr) return
    await payload.update({ collection: 'people', id, data: { name: nameAr }, locale: 'ar', overrideAccess: true, context: IMPORT_CONTEXT } as Parameters<Payload['update']>[0])
  }
  const person = async (name: string, from: string, nameAr?: string): Promise<number> => {
    const known = people.get(name)
    if (known) {
      await nameInArabic(known, nameAr)
      return known
    }
    const { docs } = await payload.find({ collection: 'people', where: { name: { equals: name } }, limit: 1, depth: 0, overrideAccess: true })
    let id = docs[0]?.id as number | undefined
    if (!id) {
      const legacy_url = `${from}#person-${slugify(name)}`
      const legacyTaken =
        (await payload.count({ collection: 'people', where: { legacy_url: { equals: legacy_url } }, overrideAccess: true })).totalDocs > 0
      id = (
        await payload.create({
          collection: 'people',
          data: {
            name,
            slug: await freeSlug(payload, 'people', slugify(name) || 'person'),
            ...(legacyTaken ? {} : { legacy_url }),
          },
          overrideAccess: true,
        })
      ).id as number
      result.people.created++
    }
    people.set(name, id)
    await nameInArabic(id, nameAr)
    return id
  }
  const resolveSeq = async (names: string[], from: string, namesAr: Record<string, string> = {}): Promise<number[]> => {
    const ids: number[] = []
    for (const n of names) ids.push(await person(n, from, namesAr[n])) // sequential: a name may repeat
    return ids
  }

  /** Credit rows in one locale: ids from the English write keep Arabic labels on the same rows. */
  const creditRows = async (
    credits: ArchiveCredit[],
    from: string,
    locale: 'en' | 'ar',
    rows?: Array<{ id?: string }>,
    namesAr: Record<string, string> = {},
  ) => {
    const out = []
    const kept = credits.filter((c) => c.people.length)
    for (const [i, c] of kept.entries()) {
      const label = c.label?.[locale]
      out.push({
        ...(rows?.[i]?.id ? { id: rows[i].id } : {}),
        role: c.role,
        ...(label ? { label } : {}),
        people: await resolveSeq(c.people, from, namesAr),
      })
    }
    return out
  }
  const hasArabicLabel = (credits: ArchiveCredit[]) => credits.some((c) => c.people.length && c.label?.ar)

  // Editor-chosen images fill an empty upload field; one already set is kept.
  const giveImage = async (collection: 'articles' | 'publications' | 'people', id: number, field: 'cover_image' | 'photo', image?: ArchiveImage) => {
    if (!image || !data.imagesDir) return
    const doc = (await payload.findByID({ collection, id, depth: 0, overrideAccess: true, draft: collection !== 'people' })) as unknown as Record<string, unknown>
    if (doc[field]) return
    const media = await mediaFor(payload, { path: `seed/${image.file}`, file: path.join(data.imagesDir, image.file), alt: image.alt })
    await payload.update({ collection, id, data: { [field]: media.id }, overrideAccess: true, context: IMPORT_CONTEXT } as Parameters<Payload['update']>[0])
  }

  // ---- Articles
  const articleIds = new Map<string, number>()
  for (const a of data.articles) {
    const english = rich(a.blocks_en, 'ltr')
    const titles = [...new Set([a.title_en, ...a.match_titles_en])]
    const namesAr = a.names_ar ?? {}
    const translation = a.translation
      ? {
          original_language: a.translation.original_language,
          original_title: a.translation.original_title,
          original_authors: await resolveSeq(a.translation.original_authors, a.legacy_url, namesAr),
          original_source: a.translation.original_source,
          original_url: a.translation.original_url ?? null,
        }
      : undefined
    const written = await put(
      'articles',
      'articles',
      { or: [{ legacy_url: { equals: a.legacy_url } }, titlesMatch(titles)] },
      {
        title: a.title_en,
        slug: slugify(a.title_en) || slugify(a.legacy_url),
        // No English text (the booklet is Arabic only): no English body, so the
        // site shows the article in its content language rather than a stand-in.
        body: english ?? null,
        authors: await resolveSeq(a.authors, a.legacy_url, namesAr),
        credits: await creditRows(a.credits, a.legacy_url, 'en', undefined, namesAr),
        ...(translation ? { translation } : {}),
        ...(a.published_date ? { published_date: a.published_date } : {}),
        // Published works from the archive: public and approved.
        requested_tier: 'public',
        tier: 'public',
        review: { status: 'approved' },
        _status: 'published',
        legacy_url: a.legacy_url,
      },
    )
    articleIds.set(a.legacy_url, written.id)
    await giveImage('articles', written.id, 'cover_image', data.images?.articles?.[a.legacy_url])
    const arabic = rich(a.blocks_ar, 'rtl')
    // Nothing Arabic (the blog posts): no Arabic write at all; a published
    // article would need an Arabic title for one.
    if (written.touched && (arabic || a.title_ar)) {
      await payload.update({
        collection: 'articles',
        id: written.id,
        data: {
          ...(a.title_ar ? { title: a.title_ar } : {}),
          // Same rule as English: no Arabic text, no Arabic body (never a copy).
          body: arabic ?? null,
          ...(hasArabicLabel(a.credits)
            ? { credits: await creditRows(a.credits, a.legacy_url, 'ar', (written.doc?.credits as Array<{ id?: string }>) ?? [], namesAr) }
            : {}),
        },
        locale: 'ar',
        overrideAccess: true,
        context: IMPORT_CONTEXT,
      } as Parameters<Payload['update']>[0])
    }
  }

  // ---- Publications
  const articleId = async (legacy: string): Promise<number | undefined> =>
    articleIds.get(legacy) ??
    ((await payload.find({ collection: 'articles', where: { legacy_url: { equals: legacy } }, limit: 1, depth: 0, overrideAccess: true })).docs[0]?.id as number | undefined)
  for (const p of data.publications) {
    const titles = [...new Set([p.title_en, ...p.match_titles_en])]
    const foreword = p.foreword ? await articleId(p.foreword) : undefined
    // The foreword leads the list too, so it belongs to the publication like its essays.
    const articles = [
      ...new Set([foreword, ...(await Promise.all(p.articles.map(articleId)))].filter((id): id is number => id !== undefined)),
    ]
    const written = await put(
      'publications',
      'publications',
      { or: [{ legacy_url: { equals: p.legacy_url } }, titlesMatch(titles)] },
      {
        kind: p.kind,
        title: p.title_en,
        slug: slugify(p.title_en),
        ...(p.subtitle_en ? { subtitle: p.subtitle_en } : {}),
        ...(rich(p.intro_en, 'ltr') ? { intro: rich(p.intro_en, 'ltr') } : {}),
        ...(articles.length ? { articles } : {}),
        credits: await creditRows(p.credits, p.legacy_url, 'en'),
        ...(p.license ? { license: p.license } : {}),
        ...(p.print_edition_url ? { print_edition_url: p.print_edition_url } : {}),
        // Published works from the archive, as the articles above.
        _status: 'published',
        legacy_url: p.legacy_url,
      },
    )
    const arabicIntro = rich(p.intro_ar, 'rtl')
    await giveImage('publications', written.id, 'cover_image', data.images?.publications?.[p.legacy_url])
    if (written.touched && (p.title_ar || p.subtitle_ar || arabicIntro || hasArabicLabel(p.credits))) {
      await payload.update({
        collection: 'publications',
        id: written.id,
        data: {
          ...(p.title_ar ? { title: p.title_ar } : {}),
          ...(p.subtitle_ar ? { subtitle: p.subtitle_ar } : {}),
          ...(arabicIntro ? { intro: arabicIntro } : {}),
          ...(hasArabicLabel(p.credits)
            ? { credits: await creditRows(p.credits, p.legacy_url, 'ar', (written.doc?.credits as Array<{ id?: string }>) ?? []) }
            : {}),
        },
        locale: 'ar',
        overrideAccess: true,
      } as Parameters<Payload['update']>[0])
    }
  }

  // ---- Press
  for (const item of data.press) {
    const authors = []
    for (const name of item.authors) {
      const { docs } = await payload.find({ collection: 'people', where: { name: { equals: name } }, limit: 1, depth: 0, overrideAccess: true })
      authors.push(docs[0] ? { person: docs[0].id } : { name })
    }
    await put(
      'press',
      'press',
      { 'links.url': { equals: item.links[0].url } },
      {
        kind: item.kind,
        title: item.title,
        ...(item.language ? { language: item.language } : {}),
        ...(item.outlet ? { outlet: { name: item.outlet } } : {}),
        authors,
        ...(item.published_date ? { published_date: item.published_date } : {}),
        ...(item.date_precision ? { date_precision: item.date_precision } : {}),
        links: item.links.map((l) => ({
          ...(l.language ? { language: l.language } : {}),
          url: l.url,
        })),
        ...(item.excerpt ? { excerpt: item.excerpt } : {}),
        legacy_url: item.legacy_url,
      },
    )
  }

  // ---- Events
  for (const e of data.events) {
    await put(
      'events',
      'events',
      { legacy_url: { equals: e.legacy_url } },
      {
        title: e.title_en,
        slug: slugify(e.title_en),
        event_type: e.event_type,
        tier: e.tier,
        schedule: { start_precision: 'day', ...e.schedule },
        speakers: (await resolveSeq(e.speakers, e.legacy_url)).map((p) => ({ person: p })),
        ...(rich(e.description_en, 'ltr') ? { description: rich(e.description_en, 'ltr') } : {}),
        legacy_url: e.legacy_url,
      },
    )
  }

  // ---- Newsletters (drafts)
  for (const n of data.newsletters) {
    await put(
      'newsletters',
      'newsletters',
      { legacy_url: { equals: n.legacy_url } },
      {
        title: n.title_en,
        slug: slugify(n.title_en),
        issue_date: n.issue_date,
        ...(rich(n.blocks_en, 'ltr') ? { body: rich(n.blocks_en, 'ltr') } : {}),
        legacy_url: n.legacy_url,
        _status: 'draft',
      },
      { draft: true },
    )
  }

  // ---- Portraits an editor added for people the content names.
  for (const [name, image] of Object.entries(data.images?.people ?? {})) {
    const { docs } = await payload.find({ collection: 'people', where: { name: { equals: name } }, limit: 1, depth: 0, overrideAccess: true })
    if (docs[0]) await giveImage('people', docs[0].id as number, 'photo', image)
  }

  return result
}
