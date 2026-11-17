import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { routing } from '@/i18n/routing'
import { PUBLIC_LISTS_TAG, revalidationOf } from '@/lib/paths'

type Slugged = { slug?: string | null }

/**
 * Drops what a document shows on the public site from the cache: its page
 * (under the current and the previous slug), its lists and their tag.
 */
export const revalidateDocument = (collection: string, doc: Slugged, previousDoc?: Slugged) => {
  const { paths, tag } = revalidationOf(collection, routing.locales, doc, previousDoc)
  try {
    for (const path of paths) revalidatePath(path)
    if (tag) revalidateTag(PUBLIC_LISTS_TAG, 'max')
  } catch {
    // Seed and import scripts have no Next cache, and these calls throw there.
  }
}

export const revalidateAfterChange =
  (collection: string): CollectionAfterChangeHook =>
  ({ doc, previousDoc }) => {
    revalidateDocument(collection, doc, previousDoc)
    return doc
  }

export const revalidateAfterDelete =
  (collection: string): CollectionAfterDeleteHook =>
  ({ doc }) => {
    revalidateDocument(collection, doc)
    return doc
  }

/**
 * After a save in a server action: the public lists expire at once, so the
 * person who saved reads the new list on their next request (a refresh),
 * where the document hooks' stale-while-revalidate would serve the old one first.
 */
export const expirePublicLists = () => {
  try {
    updateTag(PUBLIC_LISTS_TAG)
  } catch {
    // Outside a server action (tests, scripts) there is no request to read it.
  }
}
