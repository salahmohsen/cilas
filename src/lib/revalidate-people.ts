import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook } from 'payload'

import { routing } from '@/i18n/routing'
import { pathOf } from '@/lib/paths'

/** Every public page of a person, per language, under the current and the previous slug. */
export const personPagePaths = (
  doc: { slug?: string | null },
  previousDoc?: { slug?: string | null } | null,
): string[] => {
  const paths = new Set<string>()
  for (const locale of routing.locales)
    for (const source of [doc, previousDoc]) {
      const path = source ? pathOf('people', source, locale) : null
      if (path) paths.add(path)
    }
  return [...paths]
}

/**
 * Drops the cached person pages, so a saved profile shows at once. Outside
 * Next (seed and import scripts) revalidatePath throws: ignore it.
 */
export const revalidatePersonAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  try {
    for (const path of personPagePaths(doc, previousDoc)) revalidatePath(path)
  } catch {
    // Not in a Next request.
  }
  return doc
}
