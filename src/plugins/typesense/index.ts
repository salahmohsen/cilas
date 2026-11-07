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
import {
  SEARCH_COLLECTIONS,
  SEARCH_ORDER,
  type SearchCollection,
  type SearchLocale,
} from '@/lib/search-config'

import { toSearchDocument, type SearchDocument } from './documents'
import { createIndexer, type Indexer } from './indexer'

/**
 * Site search: one bilingual Typesense collection per searchable Payload
 * collection, holding exactly what an anonymous visitor may read.
 *
 * - Startup (Next server only) rebuilds every collection in the background.
 * - Saves and deletes refresh the document, read again at full depth inside
 *   the save's transaction; a person's new name or photo also refreshes
 *   every course and article they stand behind.
 */

type Doc = Record<string, unknown> & { id: number | string }

/** Per collection, the fields a record is built from. */
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

/** Where a person shows up, per collection that credits people. */
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
 * Reads as an anonymous visitor, with no locale fallback: the collections'
 * own read rules keep drafts and members-only documents out of the index.
 * Inside a hook, the read joins the save's transaction through a request
 * of its own, because the local API rewrites the request it is given (its
 * locale among the rest).
 */
const readPublic = async (
  { payload, req }: Reader,
  collection: SearchCollection,
  locale: SearchLocale,
  options: { where?: Where; page?: number; pagination?: boolean },
) => {
  const result = await payload.find({
    collection,
    locale,
    fallbackLocale: false,
    depth: 2,
    overrideAccess: false,
    select: SELECT[collection],
    populate: POPULATE,
    sort: 'id',
    limit: BATCH_SIZE,
    ...options,
    ...(req ? { req: { transactionID: req.transactionID } as PayloadRequest } : {}),
  } as Parameters<Payload['find']>[0])
  return result as unknown as { docs: Doc[]; hasNextPage: boolean }
}

/** The public documents matching `where`, as search records, in batches. */
async function* publicDocuments(
  reader: Reader,
  collection: SearchCollection,
  where?: Where,
): AsyncGenerator<SearchDocument[]> {
  for (let page = 1; ; page++) {
    const english = await readPublic(reader, collection, 'en', { where, page })
    const ids = english.docs.map((doc) => doc.id)
    const arabic = ids.length
      ? await readPublic(reader, collection, 'ar', {
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

/** Whether a save changed what a person's works show of them. */
const personChanged = (doc: Doc, previous: Doc | undefined) =>
  doc.name !== previous?.name || photoId(doc.photo) !== photoId(previous?.photo)

const createHooks = (indexer: Indexer) => {
  /** Index writes run after the save returns: a slow or absent Typesense
   * never holds up the editor. */
  const write = (payload: Payload, task: Promise<unknown>) => {
    task.catch((error) => payload.logger.error({ err: error }, '[typesense] index write failed'))
  }

  /** Re-reads these documents and upserts the public ones; ids that no
   * longer read publicly (unpublished, made private, emptied) come out. */
  const refresh = async (reader: Reader, collection: SearchCollection, ids: string[]) => {
    const documents = await collect(publicDocuments(reader, collection, { id: { in: ids } }))
    const found = new Set(documents.map((document) => document.id))
    const gone = ids.filter((id) => !found.has(id))
    write(
      reader.payload,
      Promise.all([indexer.upsert(collection, documents), indexer.remove(collection, gone)]),
    )
  }

  /** Re-indexes every public course and article crediting the person. */
  const refreshWorksOf = async (reader: Reader, personId: string) => {
    for (const [collection, where] of Object.entries(worksOf(personId)) as [
      SearchCollection,
      Where,
    ][]) {
      const documents = await collect(publicDocuments(reader, collection, where))
      write(reader.payload, indexer.upsert(collection, documents))
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
      write(req.payload, indexer.remove(collection, [String(id)]))
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
    await indexer.dropLegacy()
  } catch (error) {
    payload.logger.error({ err: error }, '[typesense] failed to drop the legacy collections')
  }
  for (const collection of SEARCH_ORDER) {
    try {
      const { indexed, removed } = await indexer.rebuild(
        collection,
        publicDocuments({ payload }, collection),
      )
      payload.logger.info(`[typesense] ${collection}: ${indexed} indexed, ${removed} stale removed`)
    } catch (error) {
      payload.logger.error({ err: error }, `[typesense] failed to rebuild ${collection}`)
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
