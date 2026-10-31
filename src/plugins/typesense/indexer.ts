import type { Client } from 'typesense'

import type { SearchCollection } from '@/lib/search-config'

import type { SearchDocument } from './documents'
import { fieldsOf, physicalNameOf } from './schema'

/**
 * Typesense writes for the search collections. Every write goes through the
 * public alias (`courses`, …), so it lands wherever search reads; only a
 * rebuild addresses the physical collection behind it.
 */

/** Collections older indexers left behind: the per-language `-ar` mirrors
 * and the Rubix plugin's indexes, which nothing reads any more. */
const LEGACY_COLLECTIONS = [
  'courses-ar',
  'articles-ar',
  'people-ar',
  'programmes',
  'publications',
  'events',
  'governance',
]

const httpStatus = (error: unknown) => (error as { httpStatus?: number }).httpStatus

/** A Typesense filter matching these ids, backtick-quoted. */
const idFilter = (ids: readonly string[]) => `id:[${ids.map((id) => `\`${id}\``).join(',')}]`

export const createIndexer = (client: Client) => {
  const importInto = async (name: string, documents: SearchDocument[]) => {
    if (!documents.length) return
    await client
      .collections<SearchDocument>(name)
      .documents()
      .import(documents, { action: 'upsert' })
  }

  const removeFrom = async (name: string, ids: readonly string[]) => {
    if (!ids.length) return
    await client
      .collections(name)
      .documents()
      .delete({ filter_by: idFilter(ids) })
  }

  const idsIn = async (name: string): Promise<string[]> => {
    const lines = await client.collections(name).documents().export({ include_fields: 'id' })
    return lines
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => (JSON.parse(line) as { id: string }).id)
  }

  const aliasTarget = async (alias: string): Promise<string | null> => {
    try {
      return (await client.aliases(alias).retrieve()).collection_name
    } catch (error) {
      if (httpStatus(error) === 404) return null
      throw error
    }
  }

  /** Points the alias at `target`, then drops every other physical
   * generation of the collection and the real collection an older indexer
   * kept under the alias's own name. */
  const pointAlias = async (
    collection: SearchCollection,
    target: string,
    existing: Set<string>,
  ) => {
    if ((await aliasTarget(collection)) !== target) {
      if (existing.has(collection)) await client.collections(collection).delete()
      await client.aliases().upsert(collection, { collection_name: target })
    }
    const generation = new RegExp(`^${collection}_[0-9a-f]{8}$`)
    for (const name of existing) {
      if (generation.test(name) && name !== target) await client.collections(name).delete()
    }
  }

  return {
    upsert: (collection: SearchCollection, documents: SearchDocument[]) =>
      importInto(collection, documents),

    remove: (collection: SearchCollection, ids: readonly string[]) => removeFrom(collection, ids),

    /**
     * Fills the collection's current schema generation with `batches`,
     * prunes records the batches no longer produce, and swaps the alias
     * over. Search keeps reading the previous generation until the swap.
     */
    rebuild: async (collection: SearchCollection, batches: AsyncIterable<SearchDocument[]>) => {
      const target = physicalNameOf(collection)
      const existing = new Set((await client.collections().retrieve()).map((entry) => entry.name))
      if (!existing.has(target)) {
        await client.collections().create({ name: target, fields: fieldsOf(collection) })
      }
      const kept = new Set<string>()
      for await (const batch of batches) {
        await importInto(target, batch)
        for (const document of batch) kept.add(document.id)
      }
      const stale = (await idsIn(target)).filter((id) => !kept.has(id))
      await removeFrom(target, stale)
      await pointAlias(collection, target, existing)
      return { indexed: kept.size, removed: stale.length }
    },

    dropLegacy: async () => {
      const existing = new Set((await client.collections().retrieve()).map((entry) => entry.name))
      for (const name of LEGACY_COLLECTIONS) {
        if (existing.has(name)) await client.collections(name).delete()
      }
    },
  }
}

export type Indexer = ReturnType<typeof createIndexer>
