import {
  SEARCH_COLLECTIONS,
  SEARCH_LOCALES,
  SEARCH_ORDER,
  localizedField,
  sortTitleField,
  type SearchCollection,
  type SearchLocale,
  type SearchSort,
} from '@/lib/search-config'

/**
 * The search panel's pure logic: which language of a bilingual hit to show,
 * which field to quote, and how the per-collection result lists merge into
 * one. Client-safe; no React.
 */

type MatchMeta = { value?: string; matchLevel?: string }

/** One Typesense hit as the InstantSearch adapter hands it over. */
export type SearchHit = {
  objectID: string
  slug?: string
  updatedAt?: number
  coverImage?: string
  contributors?: string
  courseType?: string
  _highlightResult?: Record<string, MatchMeta | undefined>
  _snippetResult?: Record<string, MatchMeta | undefined>
  [field: string]: unknown
}

export type SearchRow = {
  /** `${collection}:${objectID}`, unique across the panel. */
  id: string
  collection: SearchCollection
  hit: SearchHit
}

const otherLocale = (locale: SearchLocale): SearchLocale => (locale === 'ar' ? 'en' : 'ar')

/** The site language first, then the other one. */
const localesFor = (locale: SearchLocale): SearchLocale[] => [locale, otherLocale(locale)]

const matched = (meta: MatchMeta | undefined) =>
  meta?.matchLevel != null && meta.matchLevel !== 'none' && Boolean(meta.value?.includes('<mark'))

const textOf = (hit: SearchHit, field: string) => {
  const value = hit[field]
  return typeof value === 'string' ? value : ''
}

/**
 * The title field to show: the site language's, unless only the other
 * language's title matched the query, or the site language has none.
 */
export const titleFieldOf = (row: SearchRow, locale: SearchLocale): string => {
  const { title } = SEARCH_COLLECTIONS[row.collection]
  const [own, other] = localesFor(locale).map((entry) => localizedField(title, entry))
  if (!textOf(row.hit, own)) return other
  const highlights = row.hit._highlightResult
  return !matched(highlights?.[own]) && matched(highlights?.[other]) && textOf(row.hit, other) ? other : own
}

/** The plain title text, in the language `titleFieldOf` picks. */
export const titleOf = (row: SearchRow, locale: SearchLocale): string =>
  textOf(row.hit, titleFieldOf(row, locale))

/** Which language a text reads in, by its script. */
export const scriptOf = (text: string): SearchLocale => (/[؀-ۿ]/.test(text) ? 'ar' : 'en')

/**
 * The field worth quoting under the title: the first snippet field, site
 * language first, that Typesense actually matched. A field it did not
 * match comes back from the adapter as the whole raw value — the entire
 * essay under a title-only hit — so those never qualify.
 */
export const snippetFieldOf = (row: SearchRow, locale: SearchLocale): string | null => {
  const snippets = row.hit._snippetResult
  for (const field of SEARCH_COLLECTIONS[row.collection].snippets) {
    for (const entry of localesFor(locale)) {
      const name = localizedField(field, entry)
      if (matched(snippets?.[name])) return name
    }
  }
  return null
}

export type Contributor = { name: string; src?: string }

/** The row's contributors, each named in the site language where known. */
export const contributorsOf = (hit: SearchHit, locale: SearchLocale): Contributor[] => {
  if (!hit.contributors) return []
  try {
    const parsed = JSON.parse(hit.contributors) as Array<{
      name?: Partial<Record<SearchLocale, string>>
      photo?: string
    }>
    return parsed.flatMap((entry) => {
      const name = localesFor(locale)
        .map((key) => entry.name?.[key])
        .find(Boolean)
      if (!name) return []
      return [{ name, ...(entry.photo?.startsWith('http') ? { src: entry.photo } : {}) }]
    })
  } catch {
    return []
  }
}

/** A sentence's end: closing punctuation and its space, or a line break
 * (a heading or paragraph edge in the flattened rich text). */
const SENTENCE_END = /[.!?؟]\s+|\n+/g

/**
 * Typesense cuts its affix window mid-sentence. Re-cut it to whole
 * sentences: from the start of the sentence holding the first match to the
 * end of the sentence holding the last one, so the reader sees the words
 * they searched for in readable form. The `<mark>` tags survive untouched;
 * where the window holds no boundary, its own edge stays.
 */
export const shapeSnippet = (value: string): string => {
  const first = value.indexOf('<mark')
  if (first === -1) return value
  const last = value.lastIndexOf('</mark>') + '</mark>'.length
  let start = 0
  let end = value.length
  for (const match of value.matchAll(SENTENCE_END)) {
    const after = match.index + match[0].length
    if (after <= first) {
      start = after
    } else if (match.index >= last) {
      end = match.index + match[0].trimEnd().length
      break
    }
  }
  return value.slice(start, end).trim()
}

/** One collection's answer, as the panel holds it. */
export type CollectionResults = { hits: SearchHit[]; found: number }

/**
 * Best match as one list, not blocks per collection: a person whose name
 * equals the query leads; the content collections round-robin, so each
 * one's best hit stays near the top; people the query merely overlaps
 * trail, since a shared word is weaker evidence than a full-text match.
 */
const byRelevance = (lists: Map<SearchCollection, SearchRow[]>, query: string, locale: SearchLocale) => {
  const normalized = query.trim().toLocaleLowerCase()
  const people = lists.get('people') ?? []
  const exact = normalized
    ? people.filter((row) => titleOf(row, locale).trim().toLocaleLowerCase() === normalized)
    : []
  const weak = people.filter((row) => !exact.includes(row))
  const lanes = [...lists].filter(([collection]) => collection !== 'people').map(([, rows]) => rows)
  const interleaved: SearchRow[] = []
  for (let depth = 0; lanes.some((lane) => depth < lane.length); depth++) {
    for (const lane of lanes) if (lane[depth]) interleaved.push(lane[depth])
  }
  return [...exact, ...interleaved, ...weak]
}

/** The key Typesense sorted a list by, compared the way Typesense does
 * (code point order), so merged lists keep its order. */
const sortKeyOf = (sort: Exclude<SearchSort, 'relevance'>, locale: SearchLocale) =>
  sort === 'newest'
    ? (row: SearchRow) => -(row.hit.updatedAt ?? 0)
    : (row: SearchRow) => textOf(row.hit, sortTitleField(locale))

const compareKeys = (a: number | string, b: number | string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * Newest and A to Z merge lists Typesense already sorted. A list cut short
 * by the page size bounds the merge: a row past the last loaded key of a
 * shortened list may still have unseen rows ahead of it, so it waits for
 * Show more rather than appearing out of order.
 */
const bySortKey = (
  lists: Map<SearchCollection, { rows: SearchRow[]; complete: boolean }>,
  sort: Exclude<SearchSort, 'relevance'>,
  locale: SearchLocale,
) => {
  const key = sortKeyOf(sort, locale)
  const bounds = [...lists.values()]
    .filter((list) => !list.complete && list.rows.length)
    .map((list) => key(list.rows[list.rows.length - 1]))
  const bound = bounds.length ? bounds.reduce((a, b) => (compareKeys(a, b) <= 0 ? a : b)) : null
  return [...lists.values()]
    .flatMap((list) => list.rows)
    .filter((row) => bound == null || compareKeys(key(row), bound) <= 0)
    .sort((a, b) => compareKeys(key(a), key(b)))
}

/** Merges the per-collection results, visible collections only, into the
 * panel's single list. */
export const mergeRows = ({
  results,
  visible,
  sort,
  query,
  locale,
}: {
  results: Partial<Record<SearchCollection, CollectionResults>>
  visible: (collection: SearchCollection) => boolean
  sort: SearchSort
  query: string
  locale: SearchLocale
}): SearchRow[] => {
  const lists = new Map<SearchCollection, { rows: SearchRow[]; complete: boolean }>()
  for (const collection of SEARCH_ORDER) {
    const result = results[collection]
    if (!result || !visible(collection)) continue
    lists.set(collection, {
      rows: result.hits.map((hit) => ({ id: `${collection}:${hit.objectID}`, collection, hit })),
      complete: result.hits.length >= result.found,
    })
  }
  if (sort === 'relevance') {
    return byRelevance(new Map([...lists].map(([collection, list]) => [collection, list.rows])), query, locale)
  }
  return bySortKey(lists, sort, locale)
}

export const isSearchLocale = (value: string): value is SearchLocale =>
  (SEARCH_LOCALES as readonly string[]).includes(value)
