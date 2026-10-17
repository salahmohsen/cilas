/**
 * The site-search schema in one place, shared by the Payload indexer and the
 * browser panel. Each collection gets one Typesense collection whose
 * documents carry both site languages side by side (`title_en`,
 * `title_ar`, …): one record per Payload document, so counts are exact and
 * nothing needs merging or deduplicating in the browser.
 *
 * Client-safe: no server imports.
 */

export const SEARCH_LOCALES = ['en', 'ar'] as const
export type SearchLocale = (typeof SEARCH_LOCALES)[number]

type CollectionSpec = {
  /** The field shown as the row's heading. */
  title: string
  /** Searchable text fields with their weight; order is the tie-break. */
  fields: Record<string, number>
  /** Fields worth quoting under a hit, in order of preference. */
  snippets: readonly string[]
}

export const SEARCH_COLLECTIONS = {
  courses: {
    title: 'title',
    // `owner` joins the fellows' names; `syllabus` is the flattened session
    // flow and bibliography, deep in the weights behind the fields people
    // actually title their content with.
    fields: { title: 10, subtitle: 8, owner: 8, epigraph: 7, summary: 6, description: 5, syllabus: 3 },
    snippets: ['description', 'syllabus'],
  },
  articles: {
    title: 'title',
    // `owner` joins the authors, the translated-from authors and every
    // credited person, so a name finds everything they stand behind.
    fields: { title: 10, owner: 5, body: 3 },
    snippets: ['body'],
  },
  people: {
    title: 'name',
    fields: { name: 10 },
    snippets: [],
  },
} as const satisfies Record<string, CollectionSpec>

export type SearchCollection = keyof typeof SEARCH_COLLECTIONS

/** Section order in the panel and in the facet list. */
export const SEARCH_ORDER = ['courses', 'articles', 'people'] as const satisfies readonly SearchCollection[]

/** Course kinds the panel facets on, in Payload option order. */
export const COURSE_TYPES = ['CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT'] as const
export type CourseType = (typeof COURSE_TYPES)[number]

export const localizedField = (field: string, locale: SearchLocale): string => `${field}_${locale}`

/** Both languages of each searchable field, highest weight first. */
export const searchParametersOf = (collection: SearchCollection) => {
  const entries = Object.entries(SEARCH_COLLECTIONS[collection].fields).flatMap(([field, weight]) =>
    SEARCH_LOCALES.map((locale) => [localizedField(field, locale), weight] as const),
  )
  return {
    query_by: entries.map(([field]) => field).join(','),
    query_by_weights: entries.map(([, weight]) => weight).join(','),
  }
}

export type SearchSort = 'relevance' | 'newest' | 'alpha'

/** The sort-only title per reading language: that language's title, or the
 * other one where it has none, lowercased so A to Z ignores case. */
export const sortTitleField = (locale: SearchLocale): string => localizedField('sortTitle', locale)

/**
 * The InstantSearch index name for a collection under a sort. The
 * Typesense adapter reads `name/sort/field:direction` as `sort_by`; the
 * collection name itself is an alias the indexer keeps pointed at the
 * current schema.
 */
export const indexNameOf = (
  collection: SearchCollection,
  sort: SearchSort,
  locale: SearchLocale,
): string => {
  if (sort === 'newest') return `${collection}/sort/updatedAt:desc`
  if (sort === 'alpha') return `${collection}/sort/${sortTitleField(locale)}:asc`
  return collection
}
