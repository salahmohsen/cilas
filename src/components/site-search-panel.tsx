'use client'

import {
  Configure,
  Index,
  InstantSearch,
  useHits,
  useInstantSearch,
  useSearchBox,
} from 'react-instantsearch'
import TypesenseInstantsearchAdapter from 'typesense-instantsearch-adapter'
import { BookOpen, Newspaper, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useSearchFilters } from '@/components/search-filters'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import {
  PrivateSpaceSearch,
  usePrivateSpaces,
  type PrivateSearchSummary,
} from '@/components/private-space-search'
import { SearchResults, type SearchFacet } from '@/components/search-results'
import { clientEnv as env } from '@/env.client'
import { pathOf } from '@/lib/paths'
import {
  COMMUNITY_INDEX,
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
  withCommunity,
  type CollectionResults,
  type SearchHit,
  type SearchRow,
} from '@/lib/search-rows'

/**
 * The site search's full-screen panel (SiteSearch opens it). Results come
 * from Typesense over the InstantSearch adapter: one bilingual index per
 * collection, all in one multi_search. Its own module, with InstantSearch and
 * the adapter, so none of it loads until a reader opens the search.
 */

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

const courseFacetId = (type: string) => `course:${type}`

const searchParameters = (collection: SearchCollection) => ({
  ...searchParametersOf(collection),
  // One typo per word: two turn near-miss Arabic names into false hits.
  num_typos: 1,
  // Only titles need their full value; full-body highlighting would put the
  // whole essay in every hit.
  highlight_full_fields: SEARCH_LOCALES.map((locale) =>
    localizedField(SEARCH_COLLECTIONS[collection].title, locale),
  ).join(','),
  highlight_affix_num_tokens: 30,
})

const adapterFor = (apiKey: string) =>
  new TypesenseInstantsearchAdapter({
    server: {
      apiKey,
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
    collectionSpecificSearchParameters: {
      ...Object.fromEntries(
        SEARCH_ORDER.map((collection) => [collection, searchParameters(collection)]),
      ),
      [COMMUNITY_INDEX]: searchParameters('articles'),
    },
  })

const adapter = env.NEXT_PUBLIC_TYPESENSE_API_KEY
  ? adapterFor(env.NEXT_PUBLIC_TYPESENSE_API_KEY)
  : null

type CommunitySession = { id: number; adapter: ReturnType<typeof adapterFor> }

/** A signed-in reader's search of community articles; null for everyone else.
 * The key lasts minutes, so it is renewed a minute before it ends. */
function useCommunitySession() {
  const [session, setSession] = useState<CommunitySession | null>(null)
  useEffect(() => {
    let active = true
    let renewal: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      const response = await fetch('/api/community-search-key', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      }).catch(() => null)
      const body = (response?.ok ? await response.json().catch(() => null) : null) as {
        key?: string | null
        expiresIn?: number
      } | null
      if (!active) return
      if (!body?.key) return setSession(null)
      const next = adapterFor(body.key)
      setSession((previous) => ({ id: (previous?.id ?? 0) + 1, adapter: next }))
      renewal = setTimeout(() => void load(), Math.max((body.expiresIn ?? 120) - 60, 30) * 1000)
    }
    void load()
    return () => {
      active = false
      clearTimeout(renewal)
    }
  }, [])
  return session
}

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
  onResults: (
    collection: string,
    results: CollectionResults & { ms: number | null; facets: Record<string, number> },
  ) => void
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

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const t = useTranslations('Search')
  const siteLocale = useLocale()
  const locale = isSearchLocale(siteLocale) ? siteLocale : 'en'
  const router = useRouter()

  const { state: privateState, epoch } = usePrivateSpaces()
  const community = useCommunitySession()
  const [scope, setScope] = useState('public')
  const privateActive = scope === 'spaces'
  const privateFilters = useSearchFilters(
    privateState ? String(privateState.account) : null,
    (privateState?.spaces ?? []).map((option) => String(option.id)),
  )
  const selection = (privateState?.spaces ?? [])
    .filter((option) => !privateFilters.hidden.has(String(option.id)))
    .map((option) => option.id)
    .sort((a, b) => a - b)
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<SearchSort>('relevance')
  const publicFilters = useSearchFilters('public', [
    ...COURSE_TYPES.map(courseFacetId),
    ...SEARCH_ORDER.filter((collection) => collection !== 'courses'),
  ])
  const hidden = publicFilters.hidden
  const [pages, setPages] = useState(1)
  const [reported, setReported] = useState<Partial<Record<string, Reported>>>({})
  const [status, setStatus] = useState({ searching: false, failed: false })

  const privateBinding = JSON.stringify([
    privateState?.account,
    epoch,
    term,
    selection,
    sort,
    privateActive,
  ])
  const privateQueryBinding = JSON.stringify([privateState?.account, epoch, term, privateActive])
  const [privateCounts, setPrivateCounts] = useState<{
    binding: string
    facets: NonNullable<PrivateSearchSummary['aggregates']>['facets']
  } | null>(null)
  if (privateCounts && privateCounts.binding !== privateQueryBinding) setPrivateCounts(null)
  const privateFacets = privateCounts?.binding === privateQueryBinding ? privateCounts.facets : null
  const privateTotal =
    privateFacets
      ?.filter((facet) => selection.includes(facet.id))
      .reduce((sum, facet) => sum + facet.found, 0) ?? null
  const [privateReport, setPrivateReport] = useState<{
    binding: string
    summary: PrivateSearchSummary
  } | null>(null)
  if (privateReport && privateReport.binding !== privateBinding) setPrivateReport(null)
  const privateSummary = privateReport?.binding === privateBinding ? privateReport.summary : null
  const onPrivateSummary = useCallback(
    (summary: PrivateSearchSummary) => {
      setPrivateReport({ binding: privateBinding, summary })
      if (summary.aggregates)
        setPrivateCounts({ binding: privateQueryBinding, facets: summary.aggregates.facets })
      else if (!summary.searching) setPrivateCounts(null)
    },
    [privateBinding, privateQueryBinding, setPrivateCounts, setPrivateReport],
  )

  // A new question starts from the first page again.
  const ask =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPages(1)
    }

  const onResults = useCallback(
    (collection: string, next: Reported) => {
      setReported((previous) => ({ ...previous, [collection]: next }))
    },
    [setReported],
  )

  const results = useMemo(
    () =>
      Object.fromEntries(
        SEARCH_ORDER.map((collection) => [
          collection,
          collection === 'articles'
            ? withCommunity(reported.articles, reported[COMMUNITY_INDEX])
            : reported[collection],
        ]),
      ),
    [reported],
  ) as Partial<Record<SearchCollection, CollectionResults>>

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
        found: results[collection]?.found ?? 0,
      })),
    ]
  }, [reported, results, t])

  const rows = useMemo(
    () => mergeRows({ results, visible, sort, query: term, locale }),
    [results, visible, sort, term, locale],
  )

  const total = facets
    .filter((facet) => !hidden.has(facet.id))
    .reduce((sum, facet) => sum + (facet.found ?? 0), 0)
  const hasMore = SEARCH_ORDER.some(
    (collection) =>
      visible(collection) &&
      (results[collection]?.hits.length ?? 0) < (results[collection]?.found ?? 0),
  )
  const times = Object.values(reported).flatMap((entry) => (entry?.ms != null ? [entry.ms] : []))
  const seconds = times.length ? Math.max(...times) / 1000 : null

  const sectionOf = useCallback(
    (row: SearchRow) => {
      const id =
        row.collection === 'courses' ? courseFacetId(row.hit.courseType ?? '') : row.collection
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
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t('fieldLabel')}
    >
      {community && (
        <InstantSearch
          key={community.id}
          searchClient={community.adapter.searchClient}
          future={{ preserveSharedStateOnUnmount: true }}
        >
          <QueryRefiner term={privateActive ? '' : term} />
          <Index
            key={sort}
            indexId={COMMUNITY_INDEX}
            indexName={indexNameOf(COMMUNITY_INDEX, sort, locale)}
          >
            <Configure hitsPerPage={PAGE_SIZE * pages} />
            <ResultsReporter collection={COMMUNITY_INDEX} onResults={onResults} />
          </Index>
        </InstantSearch>
      )}
      <InstantSearch
        searchClient={adapter!.searchClient}
        future={{ preserveSharedStateOnUnmount: true }}
      >
        <QueryRefiner term={privateActive ? '' : term} />
        {SEARCH_ORDER.map((collection) => (
          <Index
            key={`${collection}:${sort}`}
            indexId={collection}
            indexName={indexNameOf(collection, sort, locale)}
          >
            <Configure
              hitsPerPage={PAGE_SIZE * pages}
              {...(collection === 'courses' && courseFilter ? { filters: courseFilter } : {})}
            />
            <ResultsReporter collection={collection} onResults={onResults} />
          </Index>
        ))}
        <Index indexId="course-types" indexName="courses">
          <Configure
            hitsPerPage={0}
            facets={['courseType']}
            maxValuesPerFacet={COURSE_TYPES.length}
          />
          <ResultsReporter collection="course-types" onResults={onResults} />
        </Index>
        <StatusReporter onStatus={setStatus} />
        <SearchResults
          query={term}
          onQueryChange={ask(setTerm)}
          scopeControl={
            privateActive || privateState?.spaces.length ? (
              <div className="border-b border-border px-5 py-3">
                <SegmentedControl
                  value={scope}
                  onValueChange={(value) => {
                    setPrivateReport(null)
                    setPrivateCounts(null)
                    setScope(value)
                  }}
                  label={t('scopeLabel')}
                  options={[
                    { value: 'public', label: t('publicSearch') },
                    { value: 'spaces', label: t('privateSpaces') },
                  ]}
                />
              </div>
            ) : null
          }
          privateContent={
            privateActive ? (
              privateState?.spaces.length ? (
                <PrivateSpaceSearch
                  key={`${privateState.account}:${epoch}`}
                  query={term}
                  spaces={selection}
                  sort={sort}
                  account={privateState.account}
                  onSummary={onPrivateSummary}
                  onOpen={(href) => {
                    window.location.assign(href)
                    onClose()
                  }}
                />
              ) : (
                <p className="px-7 py-6 text-sm text-muted-foreground" role="status">
                  {t('privateUnavailable')}
                </p>
              )
            ) : undefined
          }
          placeholder={privateActive ? t('privatePlaceholder') : undefined}
          filterLabel={privateActive ? t('spaceLabel') : undefined}
          filterDescription={privateActive ? t('privateFiltersDescription') : undefined}
          facets={
            privateActive
              ? (privateState?.spaces ?? []).map((option) => ({
                  id: String(option.id),
                  label: option.label,
                  found: privateFacets?.find((facet) => facet.id === option.id)?.found,
                }))
              : facets
          }
          hiddenFacets={privateActive ? privateFilters.hidden : hidden}
          onToggleFacet={(id) => {
            const filters = privateActive ? privateFilters : publicFilters
            filters.toggle(id)
            setPages(1)
          }}
          onClearFilters={() => {
            const filters = privateActive ? privateFilters : publicFilters
            filters.clear()
            setPages(1)
          }}
          rows={privateActive ? [] : rows}
          sectionOf={sectionOf}
          total={privateActive ? privateTotal : total}
          hasMore={hasMore}
          onShowMore={() => setPages((count) => count + 1)}
          seconds={privateActive ? null : seconds}
          searching={
            privateActive
              ? Boolean(privateState?.spaces.length) && (privateSummary?.searching ?? true)
              : status.searching
          }
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
