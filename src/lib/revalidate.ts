import { revalidatePath, revalidateTag } from 'next/cache'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeOperationHook,
} from 'payload'

import { routing } from '@/i18n/routing'
import { PUBLIC_LISTS_TAG, revalidationOf } from '@/lib/paths'

type Slugged = { slug?: string | null }

/**
 * Drops what a document shows on the public site from the cache: its page
 * (under the current and the previous slug), its lists and their tag. The
 * lists expire at once (`expire: 0`), so whoever saved reads the new list on
 * their next request, from the admin or a server action alike; a hook cannot
 * call `updateTag`, which only a server action may.
 */
export const revalidateDocument = (collection: string, doc: Slugged, previousDoc?: Slugged) => {
  const { paths, layouts, tag } = revalidationOf(collection, routing.locales, doc, previousDoc)
  try {
    for (const path of paths) revalidatePath(path)
    for (const layout of layouts) revalidatePath(layout, 'layout')
    if (tag) revalidateTag(PUBLIC_LISTS_TAG, { expire: 0 })
  } catch {
    // Seed and import scripts have no Next cache, and these calls throw there.
  }
}

const draftKey = (collection: string) => `publicRevalidationDraft:${collection}`

export const recordRevalidationDraft: CollectionBeforeOperationHook = ({
  args,
  collection,
  operation,
  req,
}) => {
  if (operation === 'create' || operation === 'update' || operation === 'restoreVersion') {
    const draftSave = (operation === 'create' || operation === 'update') && args.draft
    const publishes =
      operation === 'update' &&
      args.data &&
      '_status' in args.data &&
      args.data._status === 'published'
    req.context[draftKey(collection.slug)] = Boolean(draftSave && !publishes)
  }
  return args
}

export const revalidateAfterChange =
  (collection: string): CollectionAfterChangeHook =>
  ({ doc, previousDoc, context }) => {
    if (!context[draftKey(collection)]) revalidateDocument(collection, doc, previousDoc)
    return doc
  }

export const revalidateAfterDelete =
  (collection: string): CollectionAfterDeleteHook =>
  ({ doc }) => {
    revalidateDocument(collection, doc)
    return doc
  }
