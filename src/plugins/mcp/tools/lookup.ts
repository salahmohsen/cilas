import type { Where } from 'payload'
import { z } from 'zod/v3'

import { LOOKUP_KINDS, LOOKUP_REGISTRY, type LookupRow } from '../lookup-registry'
import { adminUrl } from '../references'
import { adminTool } from '../tool'

const MAX_LIMIT = 25

/** `like` has no escape of its own, so `%` and `_` would match anything. */
const cleanQuery = (query: string) => query.replace(/[%_\\]/g, ' ').trim()

export const lookupTool = adminTool({
  name: 'lookup',
  description:
    'Find existing records and their ids: cycles, programmes, courses, articles, forms or people. Use it before creating anything, to find ids and to avoid a duplicate (drafts are included for courses and articles). Returns only id, title or name, slug, status and a link. A published course or article that has a newer draft is shown as published, with a note.',
  shape: {
    kind: z.enum(LOOKUP_KINDS).describe('What to look for.'),
    query: z
      .string()
      .max(100)
      .optional()
      .describe('Part of the title or name, in English or Arabic. Leave out to list recent ones.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(10)
      .describe(`How many to return, at most ${MAX_LIMIT}.`),
  },
  run: async ({ kind, query, limit }, { payload, req, user }) => {
    const source = LOOKUP_REGISTRY[kind]
    const text = query ? cleanQuery(query) : ''
    const locales = source.localized ? (['en', 'ar'] as const) : (['en'] as const)

    // The newest version of each record, in each language it matched.
    type Seen = { titles: Partial<Record<'en' | 'ar', string>>; slug?: string; latest?: string }
    const seen = new Map<number, Seen>()
    for (const locale of locales) {
      const where: Where = text ? { [source.titleField]: { like: text } } : {}
      const result = await payload.find({
        collection: source.collection,
        where,
        limit,
        page: 1,
        depth: 0,
        locale,
        fallbackLocale: false,
        draft: source.drafts,
        sort: source.titleField === 'name' ? 'name' : '-updatedAt',
        select: {
          [source.titleField]: true,
          ...(source.hasSlug ? { slug: true } : {}),
          ...(source.drafts ? { _status: true } : {}),
        },
        overrideAccess: false,
        user,
        req,
      })
      for (const doc of result.docs as unknown as Array<Record<string, unknown>>) {
        const id = Number(doc.id)
        const entry: Seen = seen.get(id) ?? { titles: {} }
        const title = String(doc[source.titleField] ?? '').trim()
        if (title) entry.titles[locale] = title
        if (source.hasSlug && doc.slug) entry.slug = String(doc.slug)
        if (typeof doc._status === 'string') entry.latest = doc._status
        seen.set(id, entry)
      }
    }

    // With drafts on, the newest version of a live record may be a draft. What
    // is live is what the main record says, so ask for it apart.
    const live = new Set<number>()
    if (source.drafts && seen.size) {
      const published = await payload.find({
        collection: source.collection,
        where: { and: [{ id: { in: [...seen.keys()] } }, { _status: { equals: 'published' } }] },
        limit: seen.size,
        pagination: false,
        depth: 0,
        draft: false,
        select: { _status: true },
        overrideAccess: false,
        user,
        req,
      })
      for (const doc of published.docs) live.add(Number(doc.id))
    }

    const found: LookupRow[] = [...seen.entries()].slice(0, limit).map(([id, entry]) => {
      const isLive = live.has(id)
      const pending = isLive && entry.latest === 'draft'
      return {
        id,
        // Prefer English, but an empty English title must not hide a real Arabic one.
        title: entry.titles.en ?? entry.titles.ar ?? '',
        ...(entry.slug ? { slug: entry.slug } : {}),
        ...(source.drafts
          ? {
              status: isLive ? ('published' as const) : ('draft' as const),
              ...(pending
                ? {
                    state:
                      'Published. A newer draft is waiting for a person to review and publish.',
                  }
                : {}),
            }
          : {}),
        admin_url: adminUrl(source.collection, id),
      }
    })
    return { kind, count: found.length, results: found }
  },
})
