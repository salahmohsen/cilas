'use client'

import { personAvatarSeed } from '@/lib/avatar'

import { Highlight, Snippet } from 'react-instantsearch'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCw, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { Avatar } from '@/components/arc/avatar/avatar'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'
import { SearchField } from '@/components/arc/search-field/search-field'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import SlotText from '@/components/arc/slot-text/slot-text'
import TextMorph from '@/components/arc/text-morph/text-morph'
import type { SearchLocale, SearchSort } from '@/lib/search-config'
import {
  contributorsOf,
  isSearchLocale,
  scriptOf,
  shapeSnippet,
  snippetFieldOf,
  titleFieldOf,
  titleOf,
  type SearchHit,
  type SearchRow,
} from '@/lib/search-rows'

/** One checkbox in the Type filter: a course kind or a collection. */
export type SearchFacet = {
  id: string
  label: string
  /** Matches for the query, counted whatever the checkboxes say. */
  found: number
}

/** What a row shows of the facet it belongs to. */
export type RowSection = { label: string; icon: ReactNode }

const formatCount = (value: number) => value.toLocaleString('en')

/** "3 hours ago", in the site language; past four weeks, the date. */
function relativeTime(timestamp: number | undefined, locale: string): string | null {
  if (!timestamp) return null
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const steps: Array<[Intl.RelativeTimeFormatUnit, number, number]> = [
    ['second', 1, 60],
    ['minute', 60, 60],
    ['hour', 3600, 24],
    ['day', 86400, 7],
    ['week', 604800, 5],
  ]
  for (const [unit, size, limit] of steps) {
    const value = Math.round(seconds / size)
    if (value < limit) return format.format(-value, unit)
  }
  return new Date(timestamp).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** A copy of the hit whose snippet is re-cut at sentence boundaries:
 * InstantSearch's `Snippet` reads the snippet straight off the hit. */
function withShapedSnippet(hit: SearchHit, attribute: string): SearchHit {
  const entry = hit._snippetResult?.[attribute]
  if (!entry?.value) return hit
  return {
    ...hit,
    _snippetResult: {
      ...hit._snippetResult,
      [attribute]: { ...entry, value: shapeSnippet(entry.value) },
    },
  }
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

type FilterProps = {
  facets: SearchFacet[]
  hiddenFacets: ReadonlySet<string>
  onToggleFacet: (id: string) => void
  onClearFilters: () => void
}

/** The facet rows, shared by the desktop sidebar and the mobile sheet. The
 * 18px Arc mark sits on the lane edge; its 44px touch target stays whole. */
function TypeFacets({ facets, hiddenFacets, onToggleFacet }: Omit<FilterProps, 'onClearFilters'>) {
  return (
    <>
      {facets.map((facet) => {
        const checked = !hiddenFacets.has(facet.id)
        const disabled = facet.found === 0 && checked
        return (
          <div
            key={facet.id}
            className={`flex items-center rounded-lg pe-1 ${disabled ? 'opacity-40' : ''}`}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={() => onToggleFacet(facet.id)}
              aria-label={facet.label}
              className="-ms-3.25"
            />
            {/* The name toggles too; the checkbox carries the accessible name. */}
            <span
              className={`flex-1 text-sm font-medium ${disabled ? '' : 'cursor-pointer'}`}
              aria-hidden="true"
              onClick={() => {
                if (!disabled) onToggleFacet(facet.id)
              }}
            >
              {facet.label}
            </span>
            <SlotText
              value={facet.found}
              format={formatCount}
              spins={0}
              duration={0.6}
              className="text-sm tabular-nums text-muted-foreground"
            />
          </div>
        )
      })}
    </>
  )
}

/** The mobile filters sheet: the facets, then clear and show actions. */
function FilterSheetBody({
  total,
  onClose,
  ...props
}: FilterProps & { total: number; onClose: () => void }) {
  const t = useTranslations('Search')
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-normal text-muted-foreground">{t('type')}</legend>
        <TypeFacets {...props} />
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            props.onClearFilters()
            onClose()
          }}
          disabled={props.hiddenFacets.size === 0}
          className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          {t('clearAll')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t('showResults', { count: total })}
        </button>
      </div>
    </div>
  )
}

/** The desktop filter lane. */
function FiltersSidebar(props: FilterProps) {
  const t = useTranslations('Search')
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e border-border px-6 py-8 md:flex">
      <h2 className="font-sans text-md font-semibold tracking-tight">{t('filters')}</h2>
      <fieldset className="mt-5 flex flex-col gap-1">
        <legend className="pb-3 text-xs font-normal text-muted-foreground">{t('type')}</legend>
        <TypeFacets {...props} />
      </fieldset>
      {props.hiddenFacets.size > 0 ? (
        <button
          type="button"
          onClick={props.onClearFilters}
          className="mt-4 self-start text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          {t('clearAll')}
        </button>
      ) : null}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Results: header, states, rows, footer                               */
/* ------------------------------------------------------------------ */

/** The found-count line and the sort control. */
function ResultsHeader({
  locale,
  searching,
  seconds,
  total,
  sort,
  onSortChange,
}: {
  locale: SearchLocale
  searching: boolean
  seconds: number | null
  total: number
  sort: SearchSort
  onSortChange: (sort: SearchSort) => void
}) {
  const t = useTranslations('Search')
  const tail =
    seconds != null
      ? t('resultsTail', { count: total, seconds: seconds.toFixed(2) })
      : t('resultsOnly', { count: total })
  return (
    <div className="flex shrink-0 flex-col items-start gap-4 px-7 pb-2 pt-6 md:flex-row md:items-center">
      <p className="flex-1 text-sm text-muted-foreground" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {/* A clean sentence for screen readers: the slot's rolling strips
            would otherwise be read out digit by digit. */}
        <span className="sr-only" role="status">
          {searching
            ? t('searching')
            : t('announce', { count: total, seconds: (seconds ?? 0).toFixed(2) })}
        </span>
        <strong className="font-semibold text-foreground" aria-hidden="true">
          {searching ? (
            // The morph only renders Latin glyphs cleanly.
            locale === 'ar' ? (
              t('searching')
            ) : (
              <TextMorph>{t('searching')}</TextMorph>
            )
          ) : locale === 'ar' ? (
            // Arabic reads the digits inside the sentence, so it stays one
            // plain line rather than a rolling reel.
            tail
          ) : (
            <>
              <SlotText value={total} format={formatCount} spins={0} />{' '}
              <span className="font-normal text-muted-foreground">{tail}</span>
            </>
          )}
        </strong>
      </p>
      <SegmentedControl
        label={t('sortLabel')}
        value={sort}
        onValueChange={(value) => onSortChange(value as SearchSort)}
        options={[
          { value: 'relevance', label: t('sortRelevance') },
          { value: 'newest', label: t('sortNewest') },
          { value: 'alpha', label: t('sortAlpha') },
        ]}
      />
    </div>
  )
}

/** Nothing to list: still searching, no match, or Typesense unreachable. */
function SearchEmptyState({
  searching,
  failed,
  query,
}: {
  searching: boolean
  failed: boolean
  query: string
}) {
  const t = useTranslations('Search')
  const [title, hint] = searching
    ? [t('searching'), null]
    : failed
      ? [t('errorTitle'), t('errorHint')]
      : query.trim().length < 2
        ? [t('emptyHint'), null]
        : [t('noResultsTitle', { query }), t('noResultsHint')]
  return (
    <div className="grid place-items-center gap-3 px-6 py-20 text-center" role="status">
      <span className="text-muted-foreground" aria-hidden="true">
        {failed && !searching ? (
          <RotateCw width={20} height={20} />
        ) : (
          <Search width={20} height={20} />
        )}
      </span>
      <strong className="text-[15px] font-medium" dir="auto">
        {title}
      </strong>
      {hint ? <small className="max-w-sm text-sm text-muted-foreground">{hint}</small> : null}
    </div>
  )
}

/** One result: media, highlighted title, language tag, snippet, then the
 * contributors and the last edit. */
function SearchRowItem({
  row,
  index,
  section,
  active,
  locale,
  inputId,
  onHover,
  onOpen,
}: {
  row: SearchRow
  index: number
  section: RowSection
  active: boolean
  locale: SearchLocale
  inputId: string
  onHover: (index: number) => void
  onOpen: (row: SearchRow) => void
}) {
  const t = useTranslations('Search')
  const { hit } = row
  const isPerson = row.collection === 'people'
  const titleField = titleFieldOf(row, locale)
  const title = titleOf(row, locale)
  const snippetField = snippetFieldOf(row, locale)
  // The search index predates contributor IDs. Use the same canonical name in both locales.
  const canonicalContributors = contributorsOf(hit, 'en')
  const contributors = contributorsOf(hit, locale).map((person, index) => ({
    ...person,
    fallbackSeed: `name:${canonicalContributors[index]?.name ?? person.name}`,
  }))
  const owner = contributors.map((entry) => entry.name).join(', ')
  const updated = relativeTime(hit.updatedAt, locale)
  // The tag follows what the eye sees: a title in the other script says so.
  const titleLocale = scriptOf(title)
  const otherLanguage = titleLocale !== locale

  return (
    <li
      id={`${inputId}-row-${row.id}`}
      role="option"
      aria-selected={active}
      onMouseMove={() => {
        if (!active) onHover(index)
      }}
      onClick={() => onOpen(row)}
      className="relative cursor-pointer rounded-2xl px-3.5 py-4 md:px-5 md:py-5"
    >
      <div className="flex items-start gap-3 md:gap-4" dir="auto">
        {isPerson ? (
          <Avatar
            fallbackSeed={personAvatarSeed(hit.objectID)}
            name={title}
            src={hit.coverImage || undefined}
            size="md"
            className="shrink-0"
          />
        ) : hit.coverImage ? (
          <img
            src={hit.coverImage}
            alt=""
            loading="lazy"
            className="hidden size-12 shrink-0 rounded-xl object-cover ring-1 ring-black/10 md:block dark:ring-white/10"
          />
        ) : (
          <span
            className={`hidden size-12 shrink-0 place-items-center rounded-xl text-muted-foreground md:grid ${active ? 'text-foreground' : ''}`}
            aria-hidden="true"
          >
            {section.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-[1.4] font-medium" lang={titleLocale}>
            <Highlight attribute={titleField} hit={hit as never} />
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {otherLanguage ? (
              <>
                <span lang={locale}>{t(titleLocale === 'ar' ? 'tagArabic' : 'tagEnglish')}</span>
                {' · '}
              </>
            ) : null}
            {section.label}
          </p>
          {snippetField ? (
            // Read more opens a snippet past two lines. Only the toggle's
            // click stays out of the row, so tapping the text still opens it.
            <ExpandableText
              lines={2}
              moreLabel={t('readMore')}
              lessLabel={t('showLess')}
              className="mt-2.5"
              style={{ fontSize: '15px', lineHeight: 1.45, color: 'inherit' }}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) event.stopPropagation()
              }}
            >
              <Snippet
                attribute={snippetField}
                hit={withShapedSnippet(hit, snippetField) as never}
              />
            </ExpandableText>
          ) : null}
          {owner ? (
            // A div: several contributors stack avatars, whose group is a
            // div itself. The names truncate rather than wrap.
            <div className="mt-2.5 flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <span className="shrink-0">
                {contributors.length > 1 ? (
                  <AvatarGroup members={contributors} max={3} size="sm" label={owner} />
                ) : (
                  <Avatar
                    fallbackSeed={contributors[0]?.fallbackSeed}
                    name={owner}
                    size="sm"
                    src={contributors[0]?.src}
                  />
                )}
              </span>
              <span className="min-w-0 truncate text-foreground/80" dir="auto">
                {owner}
              </span>
            </div>
          ) : null}
          {updated ? (
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {owner ? t('editedSuffix', { when: updated }) : t('updated', { when: updated })}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** How many rows show out of all matches, and the way to load more. */
function ResultsFooter({
  shown,
  total,
  hasMore,
  searching,
  onShowMore,
}: {
  shown: number
  total: number
  hasMore: boolean
  searching: boolean
  onShowMore: () => void
}) {
  const t = useTranslations('Search')
  return (
    <div className="flex flex-col items-center gap-3 px-7 pt-2 pb-10">
      <p className="text-[13px] text-muted-foreground tabular-nums">
        {t('showing', { shown, total })}
      </p>
      {hasMore ? (
        // Never disabled: a disabled button drops focus out of the panel,
        // and Escape with it. A click while loading simply waits.
        <button
          type="button"
          onClick={() => {
            if (!searching) onShowMore()
          }}
          aria-busy={searching}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted aria-busy:opacity-60"
        >
          {t('showMore')}
        </button>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Query bar                                                           */
/* ------------------------------------------------------------------ */

/** The Arc search field with the `/` hint, the mobile filters sheet and
 * the close button. */
function SearchQueryBar({
  query,
  onQueryChange,
  inputId,
  inputRef,
  activeId,
  hasRows,
  total,
  onClose,
  ...filters
}: FilterProps & {
  query: string
  onQueryChange: (query: string) => void
  inputId: string
  inputRef: RefObject<HTMLInputElement | null>
  activeId: string | undefined
  hasRows: boolean
  total: number
  onClose: () => void
}) {
  const t = useTranslations('Search')
  // Rides on state so Show results closes the sheet.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const applied = filters.hiddenFacets.size

  return (
    <div className="relative flex shrink-0 items-center gap-3 border-b border-border px-4 py-4">
      <div className="min-w-0 flex-1">
        <SearchField
          label={t('fieldLabel')}
          labelHidden
          bare
          placeholder={t('placeholder')}
          hint={
            <kbd className="hidden size-6 items-center justify-center rounded-lg border border-border bg-muted/30 px-3 text-sm text-muted-foreground sm:inline-flex">
              /
            </kbd>
          }
          value={query}
          onValueChange={onQueryChange}
          clearLabel={t('clearField')}
          role="combobox"
          aria-expanded={hasRows}
          aria-controls={hasRows ? `${inputId}-rows` : undefined}
          aria-activedescendant={activeId}
          ref={inputRef}
          className="text-[17px]"
        />
      </div>
      {/* Mobile has no sidebar: the same facets open in a bottom sheet. */}
      <BottomSheet
        title={t('filters')}
        description={t('filtersDescription')}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        trigger={
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted md:hidden"
          >
            <SlidersHorizontal width={17} height={17} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('filters')}</span>
            {applied > 0 ? (
              <span className="grid place-items-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                {applied}
              </span>
            ) : null}
          </button>
        }
      >
        <FilterSheetBody {...filters} total={total} onClose={() => setFiltersOpen(false)} />
      </BottomSheet>
      {/* A full-screen panel has no backdrop to click away to, so on
          desktop leaving it takes a word, paired with its Escape key. On
          phones the icon keeps the field wide; the Filters button sits
          between it and the field's own clear X there. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t('closeSearch')}
        aria-keyshortcuts="Escape"
        className="inline-flex size-10 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-auto md:px-3"
      >
        <X width={20} height={20} aria-hidden="true" className="md:hidden" />
        <span className="hidden md:inline">{t('close')}</span>
        <kbd
          aria-hidden="true"
          className="hidden h-6 items-center rounded-md border border-border bg-muted/30 px-1.5 font-sans text-xs text-muted-foreground md:inline-flex"
        >
          Esc
        </kbd>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Hooks: the gliding cursor fill, the `/` shortcut                    */
/* ------------------------------------------------------------------ */

/** One neutral fill glides between rows. Measured imperatively, so a cursor
 * move never re-renders the list; reduced motion drops the transition. */
function useCursorFill(inputId: string, activeRow: SearchRow | null) {
  const listRef = useRef<HTMLUListElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  // The scroll listener reads the latest cursor through this ref.
  const activeRowRef = useRef<SearchRow | null>(null)

  const measure = useCallback(
    (current: SearchRow | null) => {
      activeRowRef.current = current
      const fill = fillRef.current
      const list = listRef.current
      if (!fill || !list) return
      const row = current ? document.getElementById(`${inputId}-row-${current.id}`) : null
      if (!row) {
        fill.style.opacity = '0'
        return
      }
      const rect = row.getBoundingClientRect()
      fill.style.transform = `translateY(${rect.top - list.getBoundingClientRect().top}px)`
      fill.style.height = `${rect.height}px`
      fill.style.opacity = '1'
    },
    [inputId],
  )

  useLayoutEffect(() => measure(activeRow), [activeRow, measure])

  // Scrolling, resizing and expanding snippets move rows under the fill.
  useEffect(() => {
    const list = listRef.current
    const scroller = list?.parentElement
    if (!list || !scroller) return
    const remeasure = () => measure(activeRowRef.current)
    const observer = new ResizeObserver(remeasure)
    observer.observe(scroller)
    observer.observe(list)
    scroller.addEventListener('scroll', remeasure, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', remeasure)
      observer.disconnect()
    }
  }, [measure])

  return { listRef, fillRef }
}

/** `/` focuses the field from anywhere in the panel, unless another field
 * has the keyboard. */
function useSlashFocus(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [inputRef])
}

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

export interface SearchResultsProps {
  query: string
  onQueryChange: (query: string) => void
  facets: SearchFacet[]
  /** Unchecked facets: their rows hide while their counts still show. */
  hiddenFacets: ReadonlySet<string>
  onToggleFacet: (id: string) => void
  onClearFilters: () => void
  rows: SearchRow[]
  sectionOf: (row: SearchRow) => RowSection
  /** All matches across the checked facets. */
  total: number
  hasMore: boolean
  onShowMore: () => void
  seconds: number | null
  searching: boolean
  failed: boolean
  sort: SearchSort
  onSortChange: (sort: SearchSort) => void
  onOpen: (row: SearchRow) => void
  onClose: () => void
}

/**
 * The faceted search panel: a query bar, a filter sidebar, and one list of
 * mixed results with the matched words marked and a keyboard cursor that
 * glides between rows. Presentation only; the Typesense wiring arrives
 * through props, inside the InstantSearch context the panel is mounted in.
 */
export function SearchResults({
  query,
  onQueryChange,
  facets,
  hiddenFacets,
  onToggleFacet,
  onClearFilters,
  rows,
  sectionOf,
  total,
  hasMore,
  onShowMore,
  seconds,
  searching,
  failed,
  sort,
  onSortChange,
  onOpen,
  onClose,
}: SearchResultsProps) {
  const t = useTranslations('Search')
  const siteLocale = useLocale()
  const locale = isSearchLocale(siteLocale) ? siteLocale : 'en'
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const filters = { facets, hiddenFacets, onToggleFacet, onClearFilters }

  // Fresh results can leave the cursor out of range: clamp while rendering.
  const cursor =
    activeIndex == null || rows.length === 0 ? null : Math.min(activeIndex, rows.length - 1)
  const activeRow = cursor == null ? null : rows[cursor]
  const activeId = activeRow ? `${inputId}-row-${activeRow.id}` : undefined

  const { listRef, fillRef } = useCursorFill(inputId, activeRow)
  useSlashFocus(inputRef)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // Keep the cursor's row in view as the keyboard moves it.
  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const move = (to: number | null) => setActiveIndex(rows.length && to != null ? to : null)

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    // In the field, j/k are letters and Home/End move the caret; the
    // arrows still step into the list, as in any combobox.
    const typing = Boolean(target.closest('input, textarea, [contenteditable="true"]'))
    const key = event.key
    if (key === 'ArrowDown' || (!typing && key === 'j')) {
      event.preventDefault()
      move(Math.min((cursor ?? -1) + 1, rows.length - 1))
    } else if (key === 'ArrowUp' || (!typing && key === 'k')) {
      event.preventDefault()
      // Up from the first row returns to the query.
      if (cursor === 0) {
        move(null)
        inputRef.current?.focus()
      } else {
        move(Math.max((cursor ?? 0) - 1, 0))
      }
    } else if (!typing && key === 'Home') {
      event.preventDefault()
      move(0)
    } else if (!typing && key === 'End') {
      event.preventDefault()
      move(rows.length - 1)
    } else if (key === 'Enter' || (!typing && key === ' ')) {
      // Focused buttons (Read more, Show more, the bar's controls) act
      // for themselves; the cursor never opens a row from under them.
      if (target.closest('button') || !activeRow) return
      event.preventDefault()
      onOpen(activeRow)
    } else if (key === 'Escape') {
      event.preventDefault()
      if (query) {
        onQueryChange('')
        move(null)
        inputRef.current?.focus()
      } else {
        onClose()
      }
    }
  }

  return (
    <div
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground outline-none [&_mark]:rounded-[5px] [&_mark]:bg-muted [&_mark]:px-0.75 [&_mark]:py-0.5 [&_mark]:font-semibold [&_mark]:text-foreground"
    >
      <SearchQueryBar
        {...filters}
        query={query}
        onQueryChange={(value) => {
          onQueryChange(value)
          move(null)
        }}
        inputId={inputId}
        inputRef={inputRef}
        activeId={activeId}
        hasRows={rows.length > 0}
        total={total}
        onClose={onClose}
      />

      <div className="flex min-h-0 flex-1">
        <FiltersSidebar {...filters} />

        <div className="flex min-w-0 flex-1 flex-col" aria-busy={searching}>
          <ResultsHeader
            locale={locale}
            searching={searching}
            seconds={seconds}
            total={total}
            sort={sort}
            onSortChange={onSortChange}
          />

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {rows.length === 0 ? (
              <SearchEmptyState searching={searching} failed={failed} query={query} />
            ) : (
              <>
                <ul
                  ref={listRef}
                  id={`${inputId}-rows`}
                  role="listbox"
                  aria-label={t('resultsLabel')}
                  className="relative flex flex-col gap-1 px-4 py-4"
                >
                  <div
                    ref={fillRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1 top-0 rounded-2xl bg-muted/60 opacity-0 transition-[transform,height,opacity] duration-150 motion-reduce:transition-none"
                  />
                  {rows.map((row, index) => (
                    <SearchRowItem
                      key={row.id}
                      row={row}
                      index={index}
                      section={sectionOf(row)}
                      active={cursor === index}
                      locale={locale}
                      inputId={inputId}
                      onHover={setActiveIndex}
                      onOpen={onOpen}
                    />
                  ))}
                </ul>
                <ResultsFooter
                  shown={rows.length}
                  total={total}
                  hasMore={hasMore}
                  searching={searching}
                  onShowMore={onShowMore}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
