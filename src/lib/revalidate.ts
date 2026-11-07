import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { routing } from '@/i18n/routing'
import { PUBLIC_LISTS_TAG, revalidationOf } from '@/lib/paths'

type Slugged = { slug?: string | null }

const drop = (collection: string, doc: Slugged, previousDoc?: Slugged) => {
  const { paths, tag } = revalidationOf(collection, routing.locales, doc, previousDoc)
  try {
    for (const path of paths) revalidatePath(path)
    if (tag) revalidateTag(PUBLIC_LISTS_TAG, 'max')
  } catch {
    // Seed and import scripts have no Next cache, and these calls throw there.
  }
}

/** Drops the cached pages and lists a saved document shows on, so the site updates at once. */
export const revalidateAfterChange =
  (collection: string): CollectionAfterChangeHook =>
  ({ doc, previousDoc }) => {
    drop(collection, doc, previousDoc)
    return doc
  }

export const revalidateAfterDelete =
  (collection: string): CollectionAfterDeleteHook =>
  ({ doc }) => {
    drop(collection, doc)
    return doc
  }
