'use client'

import {
  Configure,
  Highlight,
  Index,
  InstantSearch,
  useHits,
  useInstantSearch,
  useSearchBox,
} from 'react-instantsearch'
import TypesenseInstantsearchAdapter from 'typesense-instantsearch-adapter'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import { useCallback, useEffect, useState, type FocusEvent } from 'react'

import { env } from '@/env'
import { pathOf } from '@/lib/paths'

/**
 * Federated header search over Typesense through the official InstantSearch
 * adapter. This one talks to Typesense straight from the browser, so it needs
 * Typesense to be browser-reachable (public domain, CORS on, search-only API
 * key) — it renders nothing until NEXT_PUBLIC_TYPESENSE_API_KEY exists. The
 * content index itself is still maintained by the Payload Typesense plugin.
 */
const SECTIONS = [
  { index: 'courses', title: 'Courses' },
  { index: 'articles', title: 'Articles' },
  { index: 'people', title: 'People' },
] as const

/** One hit in a Typesense index as mapped by the Payload plugin. */
type SiteHit = { slug?: string; title?: string; name?: string; objectID: string }

// One adapter per page load; InstantSearch wants a stable search client.
const adapter = env.NEXT_PUBLIC_TYPESENSE_API_KEY
  ? new TypesenseInstantsearchAdapter({
      server: {
        apiKey: env.NEXT_PUBLIC_TYPESENSE_API_KEY,
        nodes: [
          {
            host: env.NEXT_PUBLIC_TYPESENSE_HOST,
            port: env.NEXT_PUBLIC_TYPESENSE_PORT,
            protocol: env.NEXT_PUBLIC_TYPESENSE_PROTOCOL,
          },
        ],
      },
      // Field names must match the schemas indexed by the Payload plugin.
      collectionSpecificSearchParameters: {
        courses: { query_by: 'title,subtitle,summary,description' },
        articles: { query_by: 'title,body' },
        people: { query_by: 'name' },
      },
      additionalSearchParameters: { query_by: 'title' },
    })
  : null

function SearchField({ onFocus }: { onFocus: () => void }) {
  const { query, refine } = useSearchBox()

  return (
    <input
      type="search"
      value={query}
      onChange={(event) => refine(event.currentTarget.value)}
      onFocus={onFocus}
      placeholder="Search..."
      aria-label="Search the site"
      className="h-9 w-40 rounded-md bg-transparent px-3 text-sm outline-none ring-border transition-[width] duration-200 placeholder:text-muted-foreground focus:ring-ring/50 focus:ring-[3px] focus:w-56 md:w-44 md:focus:w-64"
    />
  )
}

/** One federated section (an InstantSearch index) with its hits. */
function Section({
  title,
  index,
  locale,
  onClose,
  onCount,
}: {
  title: string
  index: (typeof SECTIONS)[number]['index']
  locale: string
  onClose: () => void
  onCount: (index: string, count: number) => void
}) {
  const { items } = useHits<SiteHit>()

  useEffect(() => {
    onCount(index, items.length)
  }, [index, items.length, onCount])

  if (!items.length) return null

  return (
    <div className="border-b border-border last:border-b-0">
      <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <ul className="pb-1">
        {items.map((hit) => {
          const label = hit.title ?? hit.name ?? hit.slug ?? hit.objectID
          const path = pathOf(index, { slug: hit.slug ?? null }, locale)

          // The index stores plain strings, so Highlight markup only appears
          // when Typesense matched against the attribute being highlighted.
          const content = (
            <Highlight
              attribute={hit.title ? 'title' : 'name'}
              hit={hit as unknown as Parameters<typeof Highlight>[0]['hit'] & SiteHit}
            />
          )

          return (
            <li key={hit.objectID}>
              {path ? (
                <Link
                  href={path}
                  onClick={onClose}
                  className="block px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <span dir="auto">{content}</span>
                </Link>
              ) : (
                <span className="block px-3 py-1.5 text-sm">
                  <span dir="auto">{label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The dropdown under the field: status, empty state, and the federated hits. */
function SearchPanel({ locale, onClose }: { locale: string; onClose: () => void }) {
  const { error, status } = useInstantSearch()
  const { query } = useSearchBox()
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({})

  // Sections report how many hits they show; the total decides "no results".
  const onCount = useCallback((index: string, count: number) => {
    setCounts((previous) =>
      previous[index] === count ? previous : { ...previous, [index]: count },
    )
  }, [])

  const total = Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0)

  if (query.trim().length < 2) return null

  return (
    <div className="absolute top-full right-0 z-50 mt-2 max-h-96 w-72 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg md:w-80">
      {error ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Search is unavailable.</p>
      ) : status === 'loading' ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
      ) : null}
      {!error &&
        SECTIONS.map((section) => (
          <Index key={section.index} indexName={section.index}>
            <Section
              title={section.title}
              index={section.index}
              locale={locale}
              onClose={onClose}
              onCount={onCount}
            />
          </Index>
        ))}
      {!error && status !== 'loading' && total === 0 && (
        <p className="px-3 py-3 text-sm text-muted-foreground">No results found.</p>
      )}
    </div>
  )
}

/** Field + results dropdown, closing when focus or Escape leaves it. */
export function SiteSearch() {
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  if (!adapter) return null

  // Close when focus moves outside the dropdown entirely — relatedTarget is
  // where focus is going, so clicks inside (results, links) keep it open.
  const trackBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
      onFocusCapture={() => setOpen(true)}
      onBlur={trackBlur}
    >
      <InstantSearch searchClient={adapter.searchClient} indexName="courses">
        <Configure hitsPerPage={5} />
        <SearchField onFocus={() => setOpen(true)} />
        {open && <SearchPanel locale={locale} onClose={() => setOpen(false)} />}
      </InstantSearch>
    </div>
  )
}
