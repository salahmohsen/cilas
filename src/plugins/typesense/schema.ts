import { createHash } from 'node:crypto'

import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection'

import {
  SEARCH_COLLECTIONS,
  SEARCH_LOCALES,
  localizedField,
  sortTitleField,
  type SearchCollection,
} from '@/lib/search-config'

/** Stored for display only: returned with each hit, never searched. */
const stored = (name: string): CollectionFieldSchema => ({
  name,
  type: 'string',
  index: false,
  optional: true,
})

/**
 * Arabic text fields use the Snowball Arabic stemmer. Its first step folds
 * hamza forms (أ إ آ → ا), taa marbuta, and harakat, so ايمان matches إيمان
 * exactly instead of through typo tolerance.
 */
const ARABIC = { locale: 'ar', stem: true } as const

export const fieldsOf = (collection: SearchCollection): CollectionFieldSchema[] => [
  stored('slug'),
  stored('coverImage'),
  { name: 'focalX', type: 'float', index: false, optional: true },
  { name: 'focalY', type: 'float', index: false, optional: true },
  stored('contributors'),
  { name: 'updatedAt', type: 'int64', sort: true },
  ...SEARCH_LOCALES.map(
    (locale) => ({ name: sortTitleField(locale), type: 'string', sort: true }) as const,
  ),
  ...(collection === 'courses'
    ? [{ name: 'courseType', type: 'string', facet: true } as const]
    : []),
  ...Object.keys(SEARCH_COLLECTIONS[collection].fields).flatMap((field) =>
    SEARCH_LOCALES.map((locale) => ({
      name: localizedField(field, locale),
      type: 'string' as const,
      ...(locale === 'ar' ? ARABIC : {}),
    })),
  ),
]

/**
 * The physical collection behind the public alias, named after a hash of
 * its schema: a schema change builds a fresh collection beside the live
 * one, and search keeps answering until the alias swaps over.
 */
export const physicalNameOf = (collection: SearchCollection): string => {
  const hash = createHash('sha1')
    .update(JSON.stringify(fieldsOf(collection)))
    .digest('hex')
  return `${collection}_${hash.slice(0, 8)}`
}
