import { revalidatePath, revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { routing } from '@/i18n/routing'
import { COURSES_TAG } from '@/lib/revalidate-courses'

const invalidate = (doc: { slug?: string }, previousDoc?: { slug?: string }) => {
  try {
    for (const locale of routing.locales) {
      for (const path of ['', '/events', '/calendar', '/signed-in'])
        revalidatePath(`/${locale}${path}`)
      for (const slug of new Set([doc.slug, previousDoc?.slug]))
        if (slug) revalidatePath(`/${locale}/events/${slug}`)
    }
    revalidatePath('/sitemap.xml')
    revalidateTag(COURSES_TAG, 'max')
  } catch {
    // Seed and import scripts have no Next cache.
  }
}

export const revalidateEventAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  invalidate(doc, previousDoc)
  return doc
}
export const revalidateEventAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  invalidate(doc)
  return doc
}
