'use client'

import { Configure, Index, InstantSearch, useHits, useInstantSearch, useSearchBox } from 'react-instantsearch'
import TypesenseInstantsearchAdapter from 'typesense-instantsearch-adapter'
import { BookOpen, Newspaper, Search, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { SearchResults, type SearchFacet } from '@/components/search-results'
import { env } from '@/env'
import { pathOf } from '@/lib/paths'
import {
  COURSE_TYPES,
  SEARCH_COLLECTIONS,
  SEARCH_LOCALES,
  SEARCH_ORDER,
  indexNameOf,
  localizedField,
  searchParametersOf,
  type CourseType,
  type SearchCollection,
  type SearchSort,
} from '@/lib/search-config'
import {
  isSearchLocale,
  mergeRows,
  type CollectionResults,
  type SearchHit,
  type SearchRow,
} from '@/lib/search-rows'

/**
 * Site search behind a full-screen panel, opened from the header button,
 * ⌘K / Ctrl + K or `/`. Results come from Typesense over the InstantSearch
 * adapter: one bilingual index per collection, all in one multi_search.
 * Typesense must be browser reachable with a search-only key; without
 * NEXT_PUBLIC_TYPESENSE_API_KEY the button hides entirely.
 */

/** Rows each collection loads per page; Show more adds another page. */
const PAGE_SIZE = 8

const SECTION_ICONS: Record<SearchCollection, ReactNode> = {
  courses: <BookOpen width={24} height={24} />,
  articles: <Newspaper width={24} height={24} />,
  people: <Users width={24} height={24} />,
}

const COURSE_TYPE_LABELS = {
  CORE: 'typeCore',
  THEMATIC: 'typeThematic',
  LAB: 'typeLab',
  WORKSHOP: 'typeWorkshop',
  SHORT: 'typeShort',
} as const satisfies Record<CourseType, string>

/** Facet ids: one per course kind, then one per other collection. */
const courseFacetId = (type: string) => `course:${type}`

const adapter = env.NEXT_PUBLIC_TYPESENSE_API_KEY
  ? new TypesenseInstantsearchAdapter({
      server: {
        apiKey: env.NEXT_PUBLIC_TYPESENSE_API_KEY,
        // The edge sometimes takes longer than the 5s default to answer.
        connectionTimeoutSeconds: 15,
        nodes: [
          {
            host: env.NEXT_PUBLIC_TYPESENSE_HOST,
            port: env.NEXT_PUBLIC_TYPESENSE_PORT,
            protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
          },
        ],
      },
      collectionSpecificSearchParameters: Object.fromEntries(
        SEARCH_ORDER.map((collection) => {
          const { title } = SEARCH_COLLECTIONS[collection]
          return [
            collection,
            {
              ...searchParametersOf(collection),
              // One typo per word: two turn near-miss Arabic names into
              // false hits.
              num_typos: 1,
              // Only titles need their full value; full-body highlighting
              // would put the whole essay in every hit.
              highlight_full_fields: SEARCH_LOCALES.map((locale) => localizedField(title, locale)).join(','),
              highlight_affix_num_tokens: 30,
            },
          ]
        }),
      ),
    })
  : null

/** Feeds the panel's own field into InstantSearch, debounced; fewer than
 * two letters browse everything instead of matching noise. */
function QueryRefiner({ term }: { term: string }) {
  const { refine } = useSearchBox()
  useEffect(() => {
    const query = term.trim()
    const timer = setTimeout(() => refine(query.length >= 2 ? query : ''), 220)
    return () => clearTimeout(timer)
  }, [term, refine])
  return null
}

/** Reports one index's hits and total upward whenever a response lands. */
function ResultsReporter({
  collection,
  onResults,
}: {
  collection: string
  onResults: (collection: string, results: CollectionResults & { ms: number | null; facets: Record<string, number> }) => void
}) {
  const { items, results } = useHits<SearchHit>()
  useEffect(() => {
    if (!results) return
    const types = results.facets?.find((facet) => facet.name === 'courseType')?.data
    onResults(collection, {
      hits: items,
      found: results.nbHits,
      ms: results.processingTimeMS ?? null,
      facets: (types as Record<string, number> | undefined) ?? {},
    })
  }, [collection, items, results, onResults])
  return null
}

/** Lifts InstantSearch's request status and error out of its context. */
function StatusReporter({
  onStatus,
}: {
  onStatus: (status: { searching: boolean; failed: boolean }) => void
}) {
  const { status, error } = useInstantSearch()
  useEffect(() => {
    onStatus({ searching: status === 'loading' || status === 'stalled', failed: Boolean(error) })
  }, [status, error, onStatus])
  return null
}

type Reported = CollectionResults & { ms: number | null; facets: Record<string, number> }

/** The search button and, while open, the panel. */
export function SiteSearch() {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const t = useTranslations('Search')

  const close = useCallback(() => {
    setOpen(false)
    // Focus returns where the reader opened the panel from.
    requestAnimationFrame(() => trigger.current?.focus())
  }, [])

  // ⌘K / Ctrl + K anywhere; `/` too, unless the reader is typing. Once
  // open, the panel's own `/` handler moves focus to its field instead.
  useEffect(() => {
    if (open) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]')
      const command = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing
      if (command || slash) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!adapter) return null

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={t('openLabel')}
        aria-keyshortcuts={t('shortcut')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-(--surface-muted)"
        onClick={() => setOpen(true)}
      >
        <Search width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {/* Portalled: the header's own stacking context would otherwise let
          the page show through the panel. */}
      {open ? createPortal(<SearchPanel searchClient={adapter.searchClient} onClose={close} />, document.body) : null}
    </>
  )
}

function SearchPanel({
  searchClient,
  onClose,
}: {
  searchClient: NonNullable<typeof adapter>['searchClient']
  onClose: () => void
}) {
  const t = useTranslations('Search')
  const siteLocale = useLocale()
  const locale = isSearchLocale(siteLocale) ? siteLocale : 'en'
  const router = useRouter()

  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<SearchSort>('relevance')
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [pages, setPages] = useState(1)
  const [reported, setReported] = useState<Partial<Record<string, Reported>>>({})
  const [status, setStatus] = useState({ searching: false, failed: false })

  // A new question starts from the first page again.
  const ask = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setPages(1)
  }

  const onResults = useCallback((collection: string, next: Reported) => {
    setReported((previous) => ({ ...previous, [collection]: next }))
  }, [])

  const hiddenTypes = COURSE_TYPES.filter((type) => hidden.has(courseFacetId(type)))
  const visible = useCallback(
    (collection: SearchCollection) =>
      collection === 'courses'
        ? COURSE_TYPES.some((type) => !hidden.has(courseFacetId(type)))
        : !hidden.has(collection),
    [hidden],
  )

  // Kind counts come from an unfiltered courses query, so hiding a kind
  // never zeroes its own count.
  const facets = useMemo<SearchFacet[]>(() => {
    const typeCounts = reported['course-types']?.facets ?? {}
    return [
      ...COURSE_TYPES.map((type) => ({
        id: courseFacetId(type),
        label: t(COURSE_TYPE_LABELS[type]),
        found: typeCounts[type] ?? 0,
      })),
      ...SEARCH_ORDER.filter((collection) => collection !== 'courses').map((collection) => ({
        id: collection,
        label: t(collection === 'articles' ? 'typeArticles' : 'typePeople'),
        found: reported[collection]?.found ?? 0,
      })),
    ]
  }, [reported, t])

  const results = useMemo(
    () => Object.fromEntries(SEARCH_ORDER.map((collection) => [collection, reported[collection]])),
    [reported],
  ) as Partial<Record<SearchCollection, CollectionResults>>

  const rows = useMemo(
    () => mergeRows({ results, visible, sort, query: term, locale }),
    [results, visible, sort, term, locale],
  )

  const total = facets.filter((facet) => !hidden.has(facet.id)).reduce((sum, facet) => sum + facet.found, 0)
  const hasMore = SEARCH_ORDER.some(
    (collection) =>
      visible(collection) && (results[collection]?.hits.length ?? 0) < (results[collection]?.found ?? 0),
  )
  const times = Object.values(reported).flatMap((entry) => (entry?.ms != null ? [entry.ms] : []))
  const seconds = times.length ? Math.max(...times) / 1000 : null

  const sectionOf = useCallback(
    (row: SearchRow) => {
      const id = row.collection === 'courses' ? courseFacetId(row.hit.courseType ?? '') : row.collection
      const label = facets.find((facet) => facet.id === id)?.label ?? ''
      return { label, icon: SECTION_ICONS[row.collection] }
    },
    [facets],
  )

  const onOpen = useCallback(
    (row: SearchRow) => {
      const path = pathOf(row.collection, { slug: row.hit.slug ?? null }, locale)
      if (path) router.push(path)
      onClose()
    },
    [locale, onClose, router],
  )

  const courseFilter = hiddenTypes.length ? `courseType:!=[${hiddenTypes.join(',')}]` : undefined

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('fieldLabel')}>
      <InstantSearch searchClient={searchClient} future={{ preserveSharedStateOnUnmount: true }}>
        <QueryRefiner term={term} />
        {SEARCH_ORDER.map((collection) => (
          <Index key={`${collection}:${sort}`} indexId={collection} indexName={indexNameOf(collection, sort, locale)}>
            <Configure
              hitsPerPage={PAGE_SIZE * pages}
              {...(collection === 'courses' && courseFilter ? { filters: courseFilter } : {})}
            />
            <ResultsReporter collection={collection} onResults={onResults} />
          </Index>
        ))}
        <Index indexId="course-types" indexName="courses">
          <Configure hitsPerPage={0} facets={['courseType']} maxValuesPerFacet={COURSE_TYPES.length} />
          <ResultsReporter collection="course-types" onResults={onResults} />
        </Index>
        <StatusReporter onStatus={setStatus} />
        <SearchResults
          query={term}
          onQueryChange={ask(setTerm)}
          facets={facets}
          hiddenFacets={hidden}
          onToggleFacet={(id) =>
            ask(setHidden)(
              (() => {
                const next = new Set(hidden)
                if (!next.delete(id)) next.add(id)
                return next
              })(),
            )
          }
          onClearFilters={() => ask(setHidden)(new Set())}
          rows={rows}
          sectionOf={sectionOf}
          total={total}
          hasMore={hasMore}
          onShowMore={() => setPages((count) => count + 1)}
          seconds={seconds}
          searching={status.searching}
          failed={status.failed}
          sort={sort}
          onSortChange={ask(setSort)}
          onOpen={onOpen}
          onClose={onClose}
        />
      </InstantSearch>
    </div>
  )
}
