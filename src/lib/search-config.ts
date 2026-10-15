/**
 * The site-search schema, in one place: Payload collection slugs, the
 * fields that go into the Typesense index, and the display names the
 * search panel shows. Both indexers (the Rubix plugin in
 * `payload.config.ts` indexing the default locale, and the Arabic
 * companion plugin in `src/plugins/typesense-locale.ts`) read this, so
 * the index schema is defined once.
 */
export const TYPESENSE_SEARCH_COLLECTIONS = {
  courses: {
    displayName: 'Courses',
    // `syllabus` is a derived field, composed by the indexer from the
    // session flow (titles, descriptions, activities) plus every
    // bibliography entry, so searching finds readings inside courses.
    searchFields: ['title', 'subtitle', 'summary', 'description', 'syllabus'],
    // The snippet field shown under a hit, when it improves the row.
    snippetField: 'description',
  },
  articles: {
    displayName: 'Articles',
    searchFields: ['title', 'body'],
    snippetField: 'body',
  },
  programmes: {
    displayName: 'Programmes',
    searchFields: ['title', 'overview'],
    snippetField: null,
  },
  publications: {
    displayName: 'Publications',
    searchFields: ['title'],
    snippetField: null,
  },
  events: {
    displayName: 'Events',
    searchFields: ['title', 'description'],
    snippetField: 'description',
  },
  people: {
    displayName: 'People',
    searchFields: ['name'],
    snippetField: null,
  },
  governance: {
    displayName: 'Governance',
    searchFields: ['title'],
    snippetField: null,
  },
} as const

export type SearchCollectionSlug = keyof typeof TYPESENSE_SEARCH_COLLECTIONS

/** The instantsearch attributes, per typesense index, flatter to type. */
export const searchAttributes = (slug: SearchCollectionSlug) =>
  TYPESENSE_SEARCH_COLLECTIONS[slug].searchFields

/**
 * Typesense collection names by site language: the default locale keeps
 * the bare slugs (the Rubix plugin has been indexing them since the
 * start); every other locale appends a suffix, starting with `-ar`.
 */
export const typesenseCollectionName = (
  slug: string,
  locale: string,
): string => (locale === 'ar' ? `${slug}-ar` : slug)
