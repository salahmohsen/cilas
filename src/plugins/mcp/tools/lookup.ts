import type { Where } from 'payload'
import { z } from 'zod/v3'

import { LOOKUP_KINDS, LOOKUP_REGISTRY, type LookupRow } from '../lookup-registry'
import { adminPath } from '../references'
import { adminTool } from '../tool'

const MAX_LIMIT = 25

/** `like` has no escape of its own, so `%` and `_` would match anything. */
const cleanQuery = (query: string) => query.replace(/[%_\\]/g, ' ').trim()

export const lookupTool = adminTool({
  name: 'lookup',
  description:
    'Find existing records and their ids: cycles, programmes, courses, articles, forms or people. Use it before creating anything, to find ids and to avoid a duplicate (drafts are included for courses and articles). Returns only id, title or name, slug and status.',
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

    const rows = new Map<number, LookupRow>()
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
        if (rows.has(id)) continue
        rows.set(id, {
          id,
          title: String(doc[source.titleField] ?? ''),
          ...(source.hasSlug && doc.slug ? { slug: String(doc.slug) } : {}),
          ...(doc._status === 'draft' || doc._status === 'published'
            ? { status: doc._status }
            : {}),
          admin_path: adminPath(source.collection, id),
        })
      }
    }
    const found = [...rows.values()].slice(0, limit)
    return { kind, count: found.length, results: found }
  },
})
