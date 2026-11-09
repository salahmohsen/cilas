import { relId } from '@/lib/relation'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionConfig,
  Config,
  Payload,
  PayloadRequest,
  Where,
} from 'payload'
import { Client } from 'typesense'

import { env } from '@/env'
import { communityParentKey } from '@/lib/community-search'
import {
  COMMUNITY_INDEX,
  SEARCH_COLLECTIONS,
  SEARCH_ORDER,
  collectionOfIndex,
  type SearchCollection,
  type SearchIndex,
  type SearchLocale,
} from '@/lib/search-config'

import { toSearchDocument, type SearchDocument } from './documents'
import { createIndexer, type Indexer } from './indexer'

/**
 * Site search: one bilingual Typesense collection per searchable Payload
 * collection, holding exactly what an anonymous visitor may read, and one
 * more for published `community` articles, which the public key cannot read.
 *
 * - Startup (Next server only) rebuilds every collection in the background.
 * - Saves and deletes refresh the document, read again at full depth inside
 *   the save's transaction; a person's new name or photo also refreshes
 *   every course and article they stand behind.
 */

type Doc = Record<string, unknown> & { id: number | string }

const SELECT = {
  courses: {
    title: true,
    slug: true,
    updatedAt: true,
    course_type: true,
    cover_image: true,
    fellows: true,
    subtitle: true,
    summary: true,
    epigraph: true,
    description: true,
    sessions: true,
    bibliography: true,
  },
  articles: {
    title: true,
    slug: true,
    updatedAt: true,
    cover_image: true,
    body: true,
    authors: true,
    translation: { original_authors: true },
    credits: true,
  },
  people: { name: true, slug: true, updatedAt: true, photo: true },
} satisfies Record<SearchCollection, Record<string, unknown>>

/** Of a related person, only what a result row shows. Uploads stay whole:
 * the storage adapter derives `url` from `filename` and `prefix`, so a
 * narrower select would leave it null. */
const POPULATE = { people: { name: true, photo: true } }

const BATCH_SIZE = 100

const worksOf = (personId: string): Partial<Record<SearchCollection, Where>> => ({
  courses: { fellows: { in: [personId] } },
  articles: {
    or: [
      { authors: { in: [personId] } },
      { 'translation.original_authors': { in: [personId] } },
      { 'credits.people': { in: [personId] } },
    ],
  },
})

type Reader = { payload: Payload; req?: PayloadRequest }

/**
 * Who an index is for. A public index reads as an anonymous visitor, so the
 * collections' own read rules keep drafts and members-only documents out. The
 * community index has no such reader: it asks for exactly its own documents,
 * and reads `visible` so that a hidden person stays out of its rows.
 */
export const accessFor = (index: SearchIndex, where?: Where) =>
  index === COMMUNITY_INDEX
    ? {
        overrideAccess: true,
        populate: { people: { ...POPULATE.people, visible: true } },
        where: {
          and: [
            { tier: { equals: 'community' } },
            { _status: { equals: 'published' } },
            ...(where ? [where] : []),
          ],
        } as Where,
      }
    : { overrideAccess: false, populate: POPULATE, ...(where ? { where } : {}) }

/**
 * Reads an index's documents with no locale fallback. Inside a hook, the read
 * joins the save's transaction through a request of its own, because the
 * local API rewrites the request it is given (its locale among the rest).
 */
const readIndex = async (
  { payload, req }: Reader,
  index: SearchIndex,
  locale: SearchLocale,
  { where, ...options }: { where?: Where; page?: number; pagination?: boolean },
) => {
  const collection = collectionOfIndex(index)
  const result = await payload.find({
    collection,
    locale,
    fallbackLocale: false,
    depth: 2,
    select: SELECT[collection],
    sort: 'id',
    limit: BATCH_SIZE,
    ...accessFor(index, where),
    ...options,
    ...(req ? { req: { transactionID: req.transactionID } as PayloadRequest } : {}),
  } as Parameters<Payload['find']>[0])
  return result as unknown as { docs: Doc[]; hasNextPage: boolean }
}

async function* documentsOf(
  reader: Reader,
  index: SearchIndex,
  where?: Where,
): AsyncGenerator<SearchDocument[]> {
  const collection = collectionOfIndex(index)
  for (let page = 1; ; page++) {
    const english = await readIndex(reader, index, 'en', { where, page })
    const ids = english.docs.map((doc) => doc.id)
    const arabic = ids.length
      ? await readIndex(reader, index, 'ar', {
          where: { id: { in: ids } },
          pagination: false,
        })
      : { docs: [] }
    const arabicById = new Map(arabic.docs.map((doc) => [doc.id, doc]))
    yield english.docs.flatMap(
      (doc) => toSearchDocument(collection, { en: doc, ar: arabicById.get(doc.id) ?? {} }) ?? [],
    )
    if (!english.hasNextPage) return
  }
}

const collect = async (batches: AsyncIterable<SearchDocument[]>) => {
  const documents: SearchDocument[] = []
  for await (const batch of batches) documents.push(...batch)
  return documents
}

const photoId = (photo: unknown) =>
  photo != null && typeof photo === 'object' ? relId(photo) : photo

const personChanged = (doc: Doc, previous: Doc | undefined) =>
  doc.name !== previous?.name || photoId(doc.photo) !== photoId(previous?.photo)

/** The indexes one document of a collection can be in. */
const indexesOf = (collection: SearchCollection): SearchIndex[] =>
  collection === 'articles' ? ['articles', COMMUNITY_INDEX] : [collection]

export const createHooks = (indexer: Indexer) => {
  /** Index writes run after the save returns: a slow or absent Typesense
   * never holds up the editor. */
  const write = (payload: Payload, task: Promise<unknown>) => {
    task.catch((error) => payload.logger.error({ err: error }, '[typesense] index write failed'))
  }

  /** Re-reads these documents for each index and upserts those it holds; ids
   * it no longer holds (unpublished, moved to another tier, emptied) come out. */
  const refresh = async (reader: Reader, collection: SearchCollection, ids: string[]) => {
    for (const index of indexesOf(collection)) {
      const documents = await collect(documentsOf(reader, index, { id: { in: ids } }))
      const found = new Set(documents.map((document) => document.id))
      const gone = ids.filter((id) => !found.has(id))
      write(
        reader.payload,
        Promise.all([indexer.upsert(index, documents), indexer.remove(index, gone)]),
      )
    }
  }

  const refreshWorksOf = async (reader: Reader, personId: string) => {
    for (const [collection, where] of Object.entries(worksOf(personId)) as [
      SearchCollection,
      Where,
    ][]) {
      for (const index of indexesOf(collection)) {
        const documents = await collect(documentsOf(reader, index, where))
        write(reader.payload, indexer.upsert(index, documents))
      }
    }
  }

  const afterChange =
    (collection: SearchCollection): CollectionAfterChangeHook =>
    async ({ doc, previousDoc, req }) => {
      // An autosave only writes the draft, which search never shows.
      if (req.searchParams?.get('autosave') === 'true') return
      const reader = { payload: req.payload, req }
      try {
        await refresh(reader, collection, [String(doc.id)])
        if (collection === 'people' && personChanged(doc, previousDoc)) {
          await refreshWorksOf(reader, String(doc.id))
        }
      } catch (error) {
        req.payload.logger.error(
          { err: error },
          `[typesense] failed to refresh ${collection}/${doc.id}`,
        )
      }
    }

  const afterDelete =
    (collection: SearchCollection): CollectionAfterDeleteHook =>
    async ({ id, req }) => {
      for (const index of indexesOf(collection)) {
        write(req.payload, indexer.remove(index, [String(id)]))
      }
      if (collection !== 'people') return
      try {
        await refreshWorksOf({ payload: req.payload, req }, String(id))
      } catch (error) {
        req.payload.logger.error(
          { err: error },
          `[typesense] failed to refresh the works of people/${id}`,
        )
      }
    }

  return { afterChange, afterDelete }
}

/** Rebuilds every search collection, one at a time, logging each. */
const syncAll = async (payload: Payload, indexer: Indexer) => {
  try {
    if (env.TYPESENSE_API_KEY && !env.TYPESENSE_COMMUNITY_SEARCH_KEY) {
      await indexer.ensureCommunityKey(communityParentKey(env.TYPESENSE_API_KEY))
    }
  } catch (error) {
    payload.logger.error({ err: error }, '[typesense] failed to register the community search key')
  }
  try {
    await indexer.dropLegacy()
  } catch (error) {
    payload.logger.error({ err: error }, '[typesense] failed to drop the legacy collections')
  }
  for (const index of SEARCH_ORDER.flatMap(indexesOf)) {
    try {
      const { indexed, removed } = await indexer.rebuild(index, documentsOf({ payload }, index))
      payload.logger.info(`[typesense] ${index}: ${indexed} indexed, ${removed} stale removed`)
    } catch (error) {
      payload.logger.error({ err: error }, `[typesense] failed to rebuild ${index}`)
    }
  }
}

const isSearchCollection = (slug: string): slug is SearchCollection => slug in SEARCH_COLLECTIONS

export const typesenseSearch =
  () =>
  (incoming: Config): Config => {
    // `next build` evaluates this config too, where the Typesense host
    // resolves nowhere; without a key there is nothing to talk to.
    if (!env.TYPESENSE_API_KEY || process.env.NEXT_PHASE === 'phase-production-build')
      return incoming

    const indexer = createIndexer(
      new Client({
        apiKey: env.TYPESENSE_API_KEY,
        connectionTimeoutSeconds: 5,
        nodes: [
          { host: env.TYPESENSE_HOST, port: env.TYPESENSE_PORT, protocol: env.TYPESENSE_PROTOCOL },
        ],
      }),
    )
    const hooks = createHooks(indexer)

    const collections = incoming.collections?.map((collection): CollectionConfig => {
      const { slug } = collection
      if (!isSearchCollection(slug)) return collection
      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          afterChange: [...(collection.hooks?.afterChange ?? []), hooks.afterChange(slug)],
          afterDelete: [...(collection.hooks?.afterDelete ?? []), hooks.afterDelete(slug)],
        },
      }
    })

    return {
      ...incoming,
      collections,
      onInit: async (payload) => {
        await incoming.onInit?.(payload)
        // Only the Next server rebuilds: CLI scripts (migrate, seed, reset)
        // boot Payload too, and would each start a full rebuild. The
        // rebuild runs in the background, so a slow Typesense never holds
        // up the boot.
        if (process.env.NEXT_RUNTIME === 'nodejs') void syncAll(payload, indexer)
      },
    }
  }
