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
/** The panel reads one search section per collection, merged by language.
 * Courses facet by kind instead: one toggle per `course_type`, so the
 * facet list never names Courses as a whole. */
const SECTIONS = [
  { id: 'courses', icon: <BookOpen width={24} height={24} /> },
  { id: 'articles', icon: <Newspaper width={24} height={24} /> },
  { id: 'people', icon: <Users width={24} height={24} /> },
] as const
/** One facet per course kind, in Payload option order; its hidden id is
 * `course:${value}` in the checkbox set, distinct from the section ids. */
const COURSE_FACETS = [
  { value: 'CORE', key: 'typeCore' },
  { value: 'THEMATIC', key: 'typeThematic' },
  { value: 'LAB', key: 'typeLab' },
  { value: 'WORKSHOP', key: 'typeWorkshop' },
  { value: 'SHORT', key: 'typeShort' },
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
      // fields people actually title their content with. `epigraph` is
      // the pull quote (authors it names in it get found). `owner`
      // carries every contributing person (fellows here), so a name
      // finds their courses even when the syllabus never mentions them.
      return 'title,subtitle,summary,epigraph,owner,description,syllabus'
    case 'articles':
      // `owner` joins the authors, translated-from authors and credited
      // people, so a person's name finds everything they stand behind.
      return 'title,owner,body'
    case 'people':
      return 'name'
    default:
      return 'title'
  }
}

/** Field weights follow `query_by` order: titles rule, names sit under
 * titles, body text follows, the syllabus blob trails. Two typos in
 * Typesense otherwise cast film blurbs as people's names. */const queryWeights = (sectionId: string): string | null => {
  switch (sectionId) {
    case 'courses':
      // Weights follow `query_by` order: epigraph sits at 7, behind the
      // summary, ahead of the owner and the body fields.
      return '10,8,6,7,8,5,3'
    case 'articles':
      return '10,5,3'
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

/** What HitsCollector reports: the hits plus the index-level metadata.
 * On the courses mirrors, `typeCounts` carries the `courseType` facet
 * histogram, so the panel can label each course-kind toggle with its
 * per-query count. */
type HitsPayload = {
  hits: SiteHit[]
  found: number
  ms: number | null
  typeCounts?: Record<string, number>
}

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
              // Only the title needs the full value; the short fields
              // stay exact around a match. Full-body highlighting puts
              // the entire essay in every hit's payload.
              highlight_full_fields: 'title',
              // The snippet window around a match: affix tokens on
              // either side (the server ignores `snippet_threshold`).
              highlight_affix_num_tokens: 30,
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
    const facets = results?.facets ?? []
    const typeCounts = facets.find((facet) => facet.name === 'courseType')?.data as
      | Record<string, number>
      | undefined
    onResults(key, {
      hits: items,
      found: results?.nbHits ?? items.length,
      ms: results?.processingTimeMS ?? null,
      ...(typeCounts ? { typeCounts } : {}),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the signature lives inside onResults
  }, [key, items, onResults, results?.nbHits, results?.processingTimeMS, results?.facets])

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
  // Labels are content names, so they ride the site language; course
  // rows label from their kind's facet instead.
  const sections = useMemo(
    () =>
      SECTIONS.filter((section) => section.id !== 'courses').map((section) => ({
        ...section,
        label: t(`type${section.id[0].toUpperCase()}${section.id.slice(1)}` as 'typeArticles' | 'typePeople'),
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
        current.ms === next.ms &&
        JSON.stringify(current.typeCounts) === JSON.stringify(next.typeCounts)
      return same ? previous : { ...previous, [key]: next }
    })
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // The facet list: courses facet by kind (Core, Thematic, Lab, …) —
  // counts per kind follow the query through the courseType histogram —
  // then the plain sections. The panel speaks billions? No — it merges
  // the two language mirrors into one facet per kind or collection:
  // counts add, filtering hides both.
  const searchSections = useMemo<SearchSection[]>(() => {
    const englishCourses = indexes[typesenseCollectionName('courses', 'en')]
    const arabicCourses = indexes[typesenseCollectionName('courses', 'ar')]
    const histograms = [englishCourses?.typeCounts, arabicCourses?.typeCounts]
    const faceted = histograms.some((entry) => entry != null)
    const courseFound = (englishCourses?.found ?? 0) + (arabicCourses?.found ?? 0)
    const courseFacets = COURSE_FACETS.map((facet) => ({
      id: `course:${facet.value}`,
      typeValue: facet.value,
      label: t(facet.key as 'typeCore'),
      icon: <BookOpen width={24} height={24} />,
      // Before a mirror reports the histogram, fall back to the whole
      // courses count on every facet, so the toggles stay usable.
      found: faceted
        ? histograms.reduce<number>((sum, entry) => sum + (entry?.[facet.value] ?? 0), 0)
        : courseFound,
    }))
    return [
      ...courseFacets,
      ...sections.map((section) => {
        const english = indexes[typesenseCollectionName(section.id, 'en')]
        const arabic = indexes[typesenseCollectionName(section.id, 'ar')]
        return {
          id: section.id,
          icon: section.icon,
          label: section.label,
          found: (english?.found ?? 0) + (arabic?.found ?? 0),
        }
      }),
    ]
  }, [sections, indexes, t])

  // Flattened rows: per section, English then Arabic, keeping an index of
  // the language for the tag the row carries. One document may live in
  // both mirrors (bilingual entries with the same text); it then shows
  // once, preferring the site language's own mirror.
  const rows = useMemo<SearchRow[]>(() => {
    const flat: Array<SearchRow & { updatedAt: number; label: string }> = []
    const positions = new Map<string, number>()
    // The site language's mirror leads each section, its matches stay
    // sharper than the other mirror's (an English title tracing the
    // Arabic name trails the Arabic-titled work itself).
    const mirrorOrder = locale === 'ar' ? (['ar', 'en'] as const) : (['en', 'ar'] as const)
    for (const section of SECTIONS) {
      for (const localeRef of mirrorOrder) {
        const payload = indexes[typesenseCollectionName(section.id, localeRef)]
        for (const hit of payload?.hits ?? []) {
          // Courses hide per kind (`course:THEMATIC`), the rest per their
          // section id; counts never depend on the checkboxes.
          const facetId =
            section.id === 'courses'
              ? `course:${(hit as { courseType?: unknown }).courseType ?? ''}`
              : section.id
          if (hidden.has(facetId)) continue
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
      // People matches split by strength: a person whose name equals the
      // query leads the list; a person the query merely overlaps (ريم
      // نجيب inside نجيب محفوظ) trails the content documents, whose
      // full-text mentions are stronger evidence than a shared token.
      const exactPeople: typeof flat = []
      const weakPeople: typeof flat = []
      const remaining: typeof flat = []
      for (const row of flat) {
        if (row.sectionId !== 'people') {
          remaining.push(row)
        } else if (row.label.trim().toLowerCase() === normalized) {
          exactPeople.push(row)
        } else {
          weakPeople.push(row)
        }
      }
      // Lanes follow the surviving rows themselves — hidden facets are
      // already out of `remaining`, so an emptied lane drops itself.
      const lanes: Array<typeof flat> = []
      for (const section of SECTIONS) {
        if (section.id === 'people') continue
        const lane = remaining.filter((row) => row.sectionId === section.id)
        if (lane.length) lanes.push(lane)
      }
      const interleaved: typeof flat = []
      for (let depth = 0; lanes.some((lane) => lane.length > depth); depth++) {
        for (const lane of lanes) {
          const row = lane[depth]
          if (row) interleaved.push(row)
        }
      }
      return [...exactPeople, ...interleaved, ...weakPeople]
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
            {/* The root Configure's `facets` state rides with every index's
                request; every mirror carries the empty-able `courseType`
                field, so only the courses mirrors fill the histogram and
                the rest answer with an empty entry. The helper's own key
                names apply (`facets`, `maxValuesPerFacet`) — the camel
                `facetBy` alias never reaches the request. */}
            <Configure
              hitsPerPage={6}
              facets={['courseType']}
              maxValuesPerFacet={20}
            />
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
