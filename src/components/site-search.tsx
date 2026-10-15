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
import { BookOpen, Newspaper, Search, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  SearchResults,
  type SearchRow,
  type SearchSection,
  type Sort,
} from '@/components/search-results'
import { env } from '@/env'
import { typesenseCollectionName } from '@/lib/search-config'
import { pathOf } from '@/lib/paths'

/**
 * Site search behind a faceted panel, opened from the header search
 * button or ⌘K / Ctrl + K. Results come from Typesense over the
 * InstantSearch adapter — one index per collection per language, sharing
 * one multi_search — and every hit opens through `pathOf`. The index is
 * bilingual by collection: bare slugs carry the default locale, `-ar`
 * mirrors carry Arabic, so Arabic titles surface in English and vice
 * versa. Typesense must be browser reachable (public domain, CORS on,
 * search-only API key): without NEXT_PUBLIC_TYPESENSE_API_KEY the button
 * hides entirely.
 */
/** The panel reads one search section per collection, merged by language. */
const SECTIONS = [
  { id: 'courses', icon: <BookOpen width={24} height={24} /> },
  { id: 'articles', icon: <Newspaper width={24} height={24} /> },
  { id: 'people', icon: <Users width={24} height={24} /> },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

/** Every InstantSearch index backing the panel, in query order. */
const INDEXES = [
  { sectionId: 'courses', locale: 'en' },
  { sectionId: 'courses', locale: 'ar' },
  { sectionId: 'articles', locale: 'en' },
  { sectionId: 'articles', locale: 'ar' },
  { sectionId: 'people', locale: 'en' },
  { sectionId: 'people', locale: 'ar' },
] as const
type IndexRef = (typeof INDEXES)[number]

const queryBy = (sectionId: string): string => {
  switch (sectionId) {
    case 'courses':
      // `syllabus` is the flattened session flow + bibliography, so course
      // materials answer queries too — deep in the weights, behind the
      // fields people actually title their content with.
      return 'title,subtitle,summary,description,syllabus'
    case 'articles':
      return 'title,body'
    case 'people':
      return 'name'
    default:
      return 'title'
  }
}

/** Field weights follow `query_by` order: titles rule, body text follows,
 * the syllabus blob trails. Two typos in Typesense otherwise cast film
 * blurbs as people's names. */
const queryWeights = (sectionId: string): string | null => {
  switch (sectionId) {
    case 'courses':
      return '10,8,6,8,3'
    case 'articles':
      return '10,3'
    case 'people':
      return '10'
    default:
      return null
  }
}

/** One hit in a Typesense index as mapped by the Payload plugin. */
type SiteHit = {
  slug?: string
  title?: string
  name?: string
  owner?: string
  updatedAt?: number | string
  objectID: string
}

/** What HitsCollector reports: the hits plus the index-level metadata. */
type HitsPayload = { hits: SiteHit[]; found: number; ms: number | null }

const adapter = env.NEXT_PUBLIC_TYPESENSE_API_KEY
  ? new TypesenseInstantsearchAdapter({
      server: {
        apiKey: env.NEXT_PUBLIC_TYPESENSE_API_KEY,
        // The slow edge sometimes needs more than the 5s default before
        // answering; retries cover it after that anyway.
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
        INDEXES.map((ref) => {
          const weights = queryWeights(ref.sectionId)
          return [
            typesenseCollectionName(ref.sectionId, ref.locale),
            {
              query_by: queryBy(ref.sectionId),
              ...(weights ? { query_by_weights: weights } : {}),
              // One typo per token: on Arabic names a two-typo threshold
              // turns near-miss film credits into false hits.
              num_typos: 1,
              // Snippets cover the queried body content, not only the title.
              highlight_full_fields: queryBy(ref.sectionId).split(','),
              snippet_threshold: 60,
            },
          ]
        }),
      ),
      additionalSearchParameters: { query_by: 'title' },
    })
  : null

/**
 * The panel's input lives in the SearchResults block, so InstantSearch
 * sees it through this no-UI widget: raw keystrokes arrive debounced,
 * below two characters resets to an empty query rather than noise.
 */
function Refiner({ term }: { term: string }) {
  const { refine } = useSearchBox()

  useEffect(() => {
    const query = term.trim()
    const timer = setTimeout(() => refine(query.length >= 2 ? query : ''), 220)
    return () => clearTimeout(timer)
  }, [term, refine])

  return null
}

/**
 * One search context per index, reporting hits, totals, and its own
 * search time upward, keyed by `${sectionId}:${locale}` with a signature
 * check so a keystroke that changes nothing re-renders nothing.
 */
function HitsCollector({
  reference,
  onResults,
}: {
  reference: IndexRef
  onResults: (key: string, payload: HitsPayload) => void
}) {
  const { items, results } = useHits<SiteHit>()
  const key = typesenseCollectionName(reference.sectionId, reference.locale)

  useEffect(() => {
    const signature = (list: SiteHit[]) => list.map((hit) => hit.objectID).join()
    onResults(key, {
      hits: items,
      found: results?.nbHits ?? items.length,
      ms: results?.processingTimeMS ?? null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature lives inside onResults
  }, [key, items, onResults, results?.nbHits, results?.processingTimeMS])

  return null
}

/** Lifts InstantSearch runtime state that hooks can only read inside. */
function StatusTracker({
  onSearching,
  onError,
}: {
  onSearching: (searching: boolean) => void
  onError: (error: unknown) => void
}) {
  const { status, error } = useInstantSearch()

  useEffect(() => {
    onSearching(status === 'loading' || status === 'stalled')
  }, [status, onSearching])

  useEffect(() => {
    onError(error)
  }, [error, onError])

  return null
}

type SectionState = Partial<Record<string, HitsPayload>>

/** Field + results panel, closing when focus or Escape leaves it. */
export function SiteSearch() {
  const t = useTranslations('Search')
  const locale = useLocale()
  const router = useRouter()
  // Labels are content names, so they ride the site language.
  const sections = useMemo(
    () => SECTIONS.map((section) => ({
      ...section,
      label: t(`type${section.id[0].toUpperCase()}${section.id.slice(1)}` as 'typeCourses' | 'typeArticles' | 'typePeople'),
    })),
    [t],
  )
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [sort, setSort] = useState<Sort>('relevance')
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set())
  const [indexes, setIndexes] = useState<SectionState>({})
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const onResults = useCallback((key: string, next: HitsPayload) => {
    setIndexes((previous) => {
      const current = previous[key]
      const same =
        current != null &&
        current.hits.map((hit) => hit.objectID).join() ===
          next.hits.map((hit) => hit.objectID).join() &&
        current.found === next.found &&
        current.ms === next.ms
      return same ? previous : { ...previous, [key]: next }
    })
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // The panel speaks billions? No — it merges the two language mirrors
  // into one section per collection: counts add, filtering hides both.
  const searchSections = useMemo<SearchSection[]>(
    () =>
      sections.map((section) => {
        const english = indexes[typesenseCollectionName(section.id, 'en')]
        const arabic = indexes[typesenseCollectionName(section.id, 'ar')]
        return {
          id: section.id,
          label: section.label,
          icon: section.icon,
          found: (english?.found ?? 0) + (arabic?.found ?? 0),
        }
      }),
    [sections, indexes],
  )

  // Flattened rows: per section, English then Arabic, keeping an index of
  // the language for the tag the row carries. One document may live in
  // both mirrors (bilingual entries with the same text); it then shows
  // once, preferring the site language's own mirror.
  const rows = useMemo<SearchRow[]>(() => {
    const flat: Array<SearchRow & { updatedAt: number; label: string }> = []
    const positions = new Map<string, number>()
    for (const section of SECTIONS) {
      if (hidden.has(section.id)) continue
      for (const localeRef of ['en', 'ar'] as const) {
        const payload = indexes[typesenseCollectionName(section.id, localeRef)]
        for (const hit of payload?.hits ?? []) {
          const row: SearchRow & { updatedAt: number; label: string } = {
            id: `${section.id}-${localeRef}-${hit.objectID}`,
            sectionId: section.id,
            locale: localeRef,
            hit: hit as unknown as SearchRow['hit'],
            owner: typeof hit.owner === 'string' && hit.owner.trim() ? hit.owner.trim() : null,
            updatedAt:
              typeof hit.updatedAt === 'number' ? hit.updatedAt : Number(hit.updatedAt ?? 0),
            label: hit.title ?? hit.name ?? hit.slug ?? '',
          }
          const key = `${section.id}-${hit.slug ?? hit.objectID}`
          const at = positions.get(key)
          if (at == null) {
            positions.set(key, flat.length)
            flat.push(row)
          } else if (localeRef === locale && flat[at].locale !== locale) {
            // The site language's copy replaces the other mirror's.
            flat[at] = row
          }
        }
      }
    }
    if (sort === 'newest') {
      return flat.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    if (sort === 'alpha') {
      return flat.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }))
    }
    // Best match reads as one relevance list, not blocks per section: a
    // person whose name matches the query exactly leads, and the rest
    // round-robin so each section's top hit stays near the top.
    const normalized = term.trim().toLowerCase()
    const pinned: typeof flat = []
    if (normalized) {
      const remaining: typeof flat = []
      for (const row of flat) {
        if (row.sectionId === 'people' && row.label.trim().toLowerCase() === normalized) {
          pinned.push(row)
        } else {
          remaining.push(row)
        }
      }
      const lanes = SECTIONS.filter((section) => !hidden.has(section.id)).map((section) =>
        remaining.filter((row) => row.sectionId === section.id),
      )
      const interleaved: typeof flat = []
      for (let depth = 0; lanes.some((lane) => lane.length > depth); depth++) {
        for (const lane of lanes) {
          const row = lane[depth]
          if (row) interleaved.push(row)
        }
      }
      return [...pinned, ...interleaved]
    }
    return flat
  }, [indexes, sort, hidden, locale, term])

  const seconds = useMemo(() => {
    const values = SECTIONS.flatMap((section) =>
      (['en', 'ar'] as const)
        .map((localeRef) => indexes[typesenseCollectionName(section.id, localeRef)]?.ms)
        .filter((ms): ms is number => typeof ms === 'number'),
    )
    return values.length ? Math.max(...values) : null
  }, [indexes])

  const onOpen = useCallback(
    (row: SearchRow) => {
      const [sectionId, , objectId] = row.id.split('-')
      const source = indexes[typesenseCollectionName(sectionId ?? '', 'en')]?.hits.find(
        (entry) => entry.objectID === objectId,
      )
      const hit =
        source ??
        indexes[typesenseCollectionName(sectionId ?? '', 'ar')]?.hits.find(
          (entry) => entry.objectID === objectId,
        )
      if (!hit) return
      const path = pathOf(sectionId, { slug: hit.slug ?? null }, locale)
      if (path) router.push(path)
      close()
    },
    [close, indexes, locale, router],
  )

  // Global open shortcut and page scroll lock.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
        type="button"
        aria-label={t('openLabel')}
        aria-keyshortcuts={t('shortcut')}
        className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-(--surface-muted)"
        onClick={() => setOpen(true)}
      >
        <Search width={16} height={16} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <InstantSearch
            searchClient={adapter.searchClient}
            indexName={typesenseCollectionName('courses', 'en')}
          >
            <Refiner term={term} />
            {INDEXES.map((ref, position) =>
              position === 0 ? null : (
                <Index
                  key={`${ref.sectionId}-${ref.locale}`}
                  indexName={typesenseCollectionName(ref.sectionId, ref.locale)}
                >
                  <Configure hitsPerPage={6} />
                  <HitsCollector reference={ref} onResults={onResults} />
                </Index>
              ),
            )}
            <Configure hitsPerPage={6} />
            <HitsCollector reference={INDEXES[0]} onResults={onResults} />
            <StatusTracker onSearching={setSearching} onError={setError} />
            <SearchResults
              query={term}
              onQueryChange={setTerm}
              sections={searchSections}
              rows={rows}
              hiddenSections={hidden}
              onToggleSection={(id) =>
                setHidden((previous) => {
                  const next = new Set(previous)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                })
              }
              onClearFilters={() => setHidden(new Set())}
              filtersDirty={hidden.size > 0}
              seconds={seconds}
              searching={searching}
              sort={sort}
              onSortChange={setSort}
              onOpen={onOpen}
              onEscape={close}
            />
          </InstantSearch>
        </div>
      )}
    </>
  )
}
