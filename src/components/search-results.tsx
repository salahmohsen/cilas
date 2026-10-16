'use client'

import { Highlight, Snippet } from 'react-instantsearch'
import { useLocale, useTranslations } from 'next-intl'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'

import { Avatar } from '@/components/arc/avatar/avatar'
import { AvatarGroup } from '@/components/arc/avatar-group/avatar-group'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { BottomSheet } from '@/components/arc/bottom-sheet/bottom-sheet'
import { SearchField } from '@/components/arc/search-field/search-field'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import SlotText from '@/components/arc/slot-text/slot-text'
import TextMorph from '@/components/arc/text-morph/text-morph'

export type SearchRow = {
  /** `${sectionId}-${locale}-${objectId}`, unique across sections. */
  id: string
  sectionId: string
  locale: 'en' | 'ar'
  hit: Record<string, unknown> & { objectID: string }
  /** The author or teacher, resolved from the related People docs. */
  owner?: string | null
}

export type SearchSection = {
  id: string
  label: string
  icon: ReactNode
  /** Total matches, counted independently of the checkboxes. */
  found: number
  /** For a course-type facet: the raw `courseType` value the hit
   * carries, so a row inside the courses index resolves to its facet. */
  typeValue?: string
}

export type Sort = 'relevance' | 'newest' | 'alpha'

/* ------------------------------------------------------------------ */
/* Typesense field schema + pure helpers                               */
/* ------------------------------------------------------------------ */

/** Highlightable/snippable field per section, in the plugin's schema.
 * The snippet source is per hit: the first field whose extract carries a
 * real match, falling back to anything with readable content — so a hit
 * matched inside a course's syllabus quotes the syllabus sentence. */
const FIELDS: Record<string, { title: string; snippets: string[] }> = {
  courses: { title: 'title', snippets: ['description', 'syllabus'] },
  articles: { title: 'title', snippets: ['body'] },
  people: { title: 'name', snippets: [] },
}

function pickSnippet(fields: { snippets: string[] }, hit: Record<string, unknown>): string | null {
  const meta = (hit as { _snippetResult?: Record<string, unknown> })._snippetResult
  const withValue = fields.snippets.filter((attribute) =>
    (meta?.[attribute] as { value?: string } | undefined)?.value?.trim(),
  )
  if (!withValue.length) return null
  return (
    withValue.find(
      (attribute) =>
        (meta?.[attribute] as { matchLevel?: string } | undefined)?.matchLevel !== 'none',
    ) ?? withValue[0]
  )
}

/** A row's contributors as Arc avatar members: the mirror's serialized
 * owner pairs carry each name with its photo, and the joined `owner`
 * string stands in when the mirrors predate the pairs. */
function ownerMembersOf(
  hit: Record<string, unknown>,
  owner: string | null,
): { name: string; src?: string }[] {
  const serialized = typeof hit.owners === 'string' ? hit.owners : ''
  if (serialized) {
    try {
      const parsed = JSON.parse(serialized) as Array<{ name?: unknown; photo?: unknown }>
      const members = parsed
        .filter(
          (entry): entry is { name: string; photo?: string } =>
            typeof entry.name === 'string' && entry.name.trim() !== '',
        )
        .map((entry) => ({
          name: entry.name,
          ...(typeof entry.photo === 'string' && entry.photo.startsWith('http')
            ? { src: entry.photo }
            : {}),
        }))
      if (members.length) return members
    } catch {
      // fall through to the joined name string
    }
  }
  return (owner?.split(/,\s*/) ?? []).map((name) => ({ name }))
}

function relativeTime(timestamp: unknown, locale: string): string | null {
  const ms =
    typeof timestamp === 'number'
      ? timestamp
      : typeof timestamp === 'string' && /^\d+$/.test(timestamp)
        ? Number(timestamp)
        : null
  if (ms == null || Number.isNaN(ms)) return null
  const seconds = Math.max(1, Math.round((Date.now() - ms) / 1000))
  // Relative formatting follows the site language: the labels ride the
  // message files, the numbers ride the locale's own calendar.
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const floor = (unit: Intl.RelativeTimeFormatUnit, value: number) => {
    const rounded = Math.round(value)
    if (rounded === 0) return null
    return rtf.format(-rounded, unit)
  }
  if (seconds < 60) return rtf.format(-seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return floor('minute', minutes) ?? rtf.format(0, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return floor('hour', hours) ?? rtf.format(0, 'hour')
  const days = Math.round(hours / 24)
  if (days < 7) return floor('day', days) ?? rtf.format(0, 'day')
  const weeks = Math.round(days / 7)
  if (weeks < 5) return floor('week', weeks) ?? rtf.format(0, 'week')
  return new Date(ms).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/* ------------------------------------------------------------------ */
/* Filters: facet rows, mobile sheet body, desktop sidebar             */
/* ------------------------------------------------------------------ */

/** The facet rows themselves, shared by the desktop sidebar and the
 * mobile filters sheet. Each row pulls the 18px Arc mark out to the lane
 * edge while its 44px touch target stays whole. */
function TypeFacets({
  sections,
  hiddenSections,
  onToggleSection,
}: {
  sections: SearchSection[]
  hiddenSections: ReadonlySet<string>
  onToggleSection: (sectionId: string) => void
}) {
  return (
    <>
      {sections.map((section) => {
        const checked = !hiddenSections.has(section.id)
        const disabled = section.found === 0
        return (
          <div
            key={section.id}
            className={`flex items-center rounded-lg pe-1 ${disabled ? 'opacity-40' : ''}`}
          >
            <Checkbox
              checked={checked}
              disabled={disabled}
              onCheckedChange={() => {
                onToggleSection(section.id)
              }}
              aria-label={section.label}
              className="-ms-3.25"
            />
            <span
              className="flex-1 cursor-pointer text-sm font-medium"
              onClick={() => {
                if (!disabled) onToggleSection(section.id)
              }}
            >
              {section.label}
            </span>
            <SlotText
              value={section.found}
              format={(value) => value.toLocaleString('en')}
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

/* The clear/show actions of the mobile filters sheet. */
function FilterSheetBody({
  sections,
  hiddenSections,
  onToggleSection,
  onClearFilters,
  filtersDirty,
  totalFound,
  onClose,
}: {
  sections: SearchSection[]
  hiddenSections: ReadonlySet<string>
  onToggleSection: (sectionId: string) => void
  onClearFilters: () => void
  filtersDirty: boolean
  totalFound: number
  onClose: () => void
}) {
  const t = useTranslations('Search')
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-1">
        <legend className="text-xs font-normal text-muted-foreground">{t('type')}</legend>
        <TypeFacets
          sections={sections}
          hiddenSections={hiddenSections}
          onToggleSection={onToggleSection}
        />
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            onClearFilters()
            onClose()
          }}
          disabled={!filtersDirty}
          className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
        >
          {t('clearAll')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t('showResults', { count: totalFound })}
        </button>
      </div>
    </div>
  )
}

/* The desktop filter lane. */
function FiltersSidebar({
  sections,
  hiddenSections,
  onToggleSection,
  onClearFilters,
  filtersDirty,
}: {
  sections: SearchSection[]
  hiddenSections: ReadonlySet<string>
  onToggleSection: (sectionId: string) => void
  onClearFilters: () => void
  filtersDirty: boolean
}) {
  const t = useTranslations('Search')
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-e border-border px-6 py-8 md:flex">
      <h2 className="font-sans text-md font-semibold tracking-tight">{t('filters')}</h2>
      <fieldset className="mt-5 flex flex-col gap-1">
        <legend className="pb-3 text-xs font-normal text-muted-foreground">{t('type')}</legend>
        <TypeFacets
          sections={sections}
          hiddenSections={hiddenSections}
          onToggleSection={onToggleSection}
        />
      </fieldset>
      {filtersDirty ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="self-start text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Clear all
        </button>
      ) : null}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Results: header (count + sort), empty state, one row                */
/* ------------------------------------------------------------------ */

/** The found-count line and the sort control. */
function ResultsHeader({
  locale,
  searching,
  seconds,
  totalFound,
  sort,
  onSortChange,
}: {
  locale: string
  searching: boolean
  seconds: number | null
  totalFound: number
  sort: Sort
  onSortChange: (sort: Sort) => void
}) {
  const t = useTranslations('Search')
  return (
    <div className="flex flex-col items-start md:flex-row shrink-0 md:items-center gap-4 px-7 pb-2 pt-6">
      {/* Update text inside a stable region, so a polite live area
          announces the count without an aria-rerender storm. */}
      <p
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        className="flex-1 text-sm text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground"
      >
        {searching ? (
          // Searching morphs only where the glyphs sit right: Latin.
          <strong className="font-semibold text-foreground">
            {locale === 'ar' ? (
              <span dir="rtl">{t('searching')}</span>
            ) : (
              <TextMorph>{t('searching')}</TextMorph>
            )}
          </strong>
        ) : locale === 'ar' ? (
          // The Arabic line reads nested digits between Arabic words,
          // so it stays one plain sentence rather than a rolling reel.
          <strong className="font-semibold text-foreground" dir="rtl">
            {seconds != null
              ? t('resultsTail', {
                  count: totalFound,
                  seconds: (seconds / 1000).toFixed(2),
                })
              : t('resultsOnly', { count: totalFound })}
          </strong>
        ) : (
          <>
            {/* Announcements get a clean sentence of their own: a live
                region would otherwise read the slot's rolling strips. */}
            <span className="sr-only" role="status">
              {seconds != null
                ? t('announce', {
                    count: totalFound,
                    seconds: (seconds / 1000).toFixed(2),
                  })
                : t('announce', { count: totalFound, seconds: 0 })}
            </span>
            <strong className="font-semibold text-foreground">
              <SlotText
                value={totalFound}
                format={(value) => value.toLocaleString('en')}
                spins={0}
              />
            </strong>{' '}
            {/* The words after the count stay static: the morph keeps
                both glyph sets alive and doubles the text. */}
            <span>
              {seconds != null
                ? t('resultsTail', {
                    count: totalFound,
                    seconds: (seconds / 1000).toFixed(2),
                  })
                : t('resultsOnly', { count: totalFound })}
            </span>
          </>
        )}
      </p>
      <SegmentedControl
        label={t('sortLabel')}
        value={sort}
        onValueChange={(value) => onSortChange(value as Sort)}
        options={[
          { value: 'relevance', label: t('sortRelevance') },
          { value: 'newest', label: t('sortNewest') },
          { value: 'alpha', label: t('sortAlpha') },
        ]}
      />
    </div>
  )
}

/* The empty / too-short-query panel. */
function SearchEmptyState({ searching, query }: { searching: boolean; query: string }) {
  const t = useTranslations('Search')
  return (
    <div className="grid place-items-center gap-3 px-6 py-20 text-center" role="status">
      <span className="text-muted-foreground" aria-hidden="true">
        <Search width={20} height={20} />
      </span>
      <strong className="text-[15px] font-medium" dir="auto">
        {searching
          ? t('searching')
          : query.trim().length < 2
            ? t('emptyHint')
            : t('noResultsTitle', { query })}
      </strong>
      {!searching && query.trim().length >= 2 ? (
        <small className="text-sm text-muted-foreground">{t('noResultsHint')}</small>
      ) : null}
    </div>
  )
}

/** One result row: media, highlighted title, language tag, snippet, and
 * the contributor line with relative time. */
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
  section?: SearchSection
  active: boolean
  locale: string
  inputId: string
  onHover: (index: number) => void
  onOpen: (row: SearchRow) => void
}) {
  const t = useTranslations('Search')
  const fields = FIELDS[row.sectionId]
  const updated = relativeTime(row.hit.updatedAt, locale)
  const owner = row.owner ?? null
  // Row media: covers for docs (fallback icon), the person's own photo
  // for people (fallback initials).
  const media =
    typeof row.hit.coverImage === 'string' && row.hit.coverImage ? row.hit.coverImage : null
  const isPerson = row.sectionId === 'people'
  const snippet = pickSnippet(fields, row.hit)
  const title = (row.hit.title ?? row.hit.name ?? '') as string
  const arabicScript = /[\u0600-\u06FF]/.test(title)
  // The tag follows what the eye sees: a title written in the other
  // script gets that language's tag, whichever mirror it sits in. The
  // line itself inherits the row's resolved direction, so it starts
  // where the title does.
  const otherTag = arabicScript ? t('tagArabic') : row.locale !== locale ? t('tagEnglish') : null
  const tagSeparator = arabicScript || row.locale !== locale ? ' · ' : ''

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
            name={owner ?? (row.hit.name as string | undefined) ?? ''}
            src={media ?? undefined}
            size="md"
            className="shrink-0"
          />
        ) : media ? (
          <img
            src={media}
            alt=""
            loading="lazy"
            className="hidden size-12 shrink-0 rounded-xl object-cover ring-1 ring-black/10 dark:ring-white/10 md:block"
          />
        ) : (
          <span
            className={`hidden size-12 shrink-0 place-items-center rounded-xl text-muted-foreground md:grid ${active ? 'text-foreground' : ''}`}
            aria-hidden="true"
          >
            {section?.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium leading-[1.4]">
            <Highlight attribute={fields.title} hit={row.hit as never} />
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {otherTag ? (
              <span lang={arabicScript ? 'ar' : 'en'} dir={arabicScript ? 'rtl' : 'ltr'}>
                {otherTag}
              </span>
            ) : null}
            {tagSeparator}
            {section?.label}
          </p>
          {snippet ? (
            <p className="mt-2.5 line-clamp-2 text-[15px] leading-[1.45]">
              <Snippet attribute={snippet} hit={row.hit as never} />
            </p>
          ) : null}
          {owner ? (
            // A div: several contributors stack Avatars, whose group is a
            // div and cannot live in a p. The name truncates instead of
            // wrapping; the time gets its own line below, so the line
            // never bends around it.
            <div className="mt-2.5 flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <span className="shrink-0">
                {ownerMembersOf(row.hit, owner).length > 1 ? (
                  <AvatarGroup
                    members={ownerMembersOf(row.hit, owner)}
                    max={3}
                    size="sm"
                    label={owner}
                  />
                ) : (
                  <Avatar
                    name={owner}
                    size="sm"
                    src={
                      typeof row.hit.ownerPhoto === 'string' && row.hit.ownerPhoto
                        ? row.hit.ownerPhoto
                        : undefined
                    }
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

/* ------------------------------------------------------------------ */
/* Query bar (field + mobile filters sheet + close)                    */
/* ------------------------------------------------------------------ */

/** The query bar, built from the Arc search field: the field keeps its
 * own smoothing and focus behaviour, the `/` hint lives inside the
 * shell exactly while the field is empty, and a structure border closes
 * the bar from the content lanes beneath. */
function SearchQueryBar({
  query,
  onQueryChange,
  inputId,
  inputRef,
  activeId,
  hasRows,
  sections,
  hiddenSections,
  onToggleSection,
  onClearFilters,
  filtersDirty,
  totalFound,
  onEscape,
}: {
  query: string
  onQueryChange: (query: string) => void
  inputId: string
  inputRef: RefObject<HTMLInputElement | null>
  activeId: string | undefined
  hasRows: boolean
  sections: SearchSection[]
  hiddenSections: ReadonlySet<string>
  onToggleSection: (sectionId: string) => void
  onClearFilters: () => void
  filtersDirty: boolean
  totalFound: number
  onEscape: () => void
}) {
  const t = useTranslations('Search')
  // The mobile filters sheet rides on this state so "Show results" closes it.
  const [filtersOpen, setFiltersOpen] = useState(false)

  return (
    <div className="relative flex shrink-0 items-center gap-3 border-b border-border px-4 py-4 md:px-4">
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
      {/* Mobile lanes lose the sidebar, so the mirror bar opens the same
          facets in a bottom sheet, with the count of applied filters. */}
      <BottomSheet
        title={t('filters')}
        description={t('filtersDescription')}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        trigger={
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium transition-colors hover:bg-muted md:hidden"
            aria-keyshortcuts={undefined}
          >
            <SlidersHorizontal width={17} height={17} strokeWidth={1.75} aria-hidden="true" />
            <span>{t('filters')}</span>
            {hiddenSections.size > 0 ? (
              <span className="grid place-items-center rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                {hiddenSections.size}
              </span>
            ) : null}
          </button>
        }
      >
        <FilterSheetBody
          sections={sections}
          hiddenSections={hiddenSections}
          onToggleSection={onToggleSection}
          onClearFilters={onClearFilters}
          filtersDirty={filtersDirty}
          totalFound={totalFound}
          onClose={() => setFiltersOpen(false)}
        />
      </BottomSheet>
      <button
        type="button"
        aria-label={t('close')}
        onClick={onEscape}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X width={20} height={20} aria-hidden="true" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Hooks: the gliding cursor fill, the `/` shortcut                    */
/* ------------------------------------------------------------------ */

/** One neutral fill glides between rows: keyboard moves step, pointer
 * moves jump straight. Measured imperatively so a cursor move never
 * cascades a render; reduced motion keeps it a plain crossfade. */
function useCursorFill(inputId: string, activeRow: SearchRow | null) {
  const listRef = useRef<HTMLUListElement>(null)
  const fillTarget = useRef<HTMLDivElement>(null)
  // The scroll listener reads the last cursor through this ref; passive
  // effects run after layout effects, so the active row also lands here
  // every time the cursor measurer fires.
  const activeRowRef = useRef<SearchRow | null>(null)
  const measureFill = useCallback(
    (current: SearchRow | null) => {
      activeRowRef.current = current
      const fill = fillTarget.current
      const container = listRef.current
      if (!fill || !container) return
      const row = current ? document.getElementById(`${inputId}-row-${current.id}`) : null
      if (!row) {
        fill.style.opacity = '0'
        return
      }
      // Rects in the same snapshot: the list scroll happens on the wrapper,
      // not the list itself, so no scroll offset enters the arithmetic.
      const containerTop = container.getBoundingClientRect().top
      const rowRect = row.getBoundingClientRect()
      const move: CSSProperties = {
        transform: `translateY(${rowRect.top - containerTop}px)`,
        height: `${rowRect.height}px`,
        opacity: '1',
      }
      for (const [property, value] of Object.entries(move)) {
        fill.style.setProperty(property, value)
      }
    },
    [inputId],
  )
  useLayoutEffect(() => {
    measureFill(activeRow)
  }, [activeRow, measureFill])
  // Scrolling and resizes move the rows under the fill; keep it glued.
  useEffect(() => {
    const scroller = listRef.current?.parentElement
    if (!scroller) return
    const onScroll = () => measureFill(activeRowRef.current)
    const observer = new ResizeObserver(onScroll)
    observer.observe(scroller)
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [measureFill])

  return { listRef, fillTarget }
}

/** `/` focuses the field from anywhere, unless another field is speaking. */
function useSlashFocus(inputRef: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
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
  sections: SearchSection[]
  rows: SearchRow[]
  /** Unchecked sections, whose rows hide while counts still show. */
  hiddenSections: ReadonlySet<string>
  onToggleSection: (sectionId: string) => void
  onClearFilters: () => void
  filtersDirty: boolean
  seconds: number | null
  searching: boolean
  sort: Sort
  onSortChange: (sort: Sort) => void
  onOpen: (row: SearchRow) => void
  /** Esc with an empty query — the caller decides what closing means. */
  onEscape: () => void
}

/**
 * The faceted site search panel: a query bar, a filter sidebar, and one
 * flowing list of results. Presentation and interaction live here; the
 * Typesense wiring (queries, hits, found counts, timing) arrives through
 * props, inside the InstantSearch context this panel is mounted in.
 *
 * Design follows the Arc `search-results` block: the query field with a
 * clear control and a `/` hint, a filter sidebar whose counts follow the
 * query disjunctively, one list of mixed results with the matched words
 * marked, and a keyboard cursor that glides between rows.
 */
export function SearchResults({
  query,
  onQueryChange,
  sections,
  rows,
  hiddenSections,
  onToggleSection,
  onClearFilters,
  filtersDirty,
  seconds,
  searching,
  sort,
  onSortChange,
  onOpen,
  onEscape,
}: SearchResultsProps) {
  const locale = useLocale()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const totalFound = sections
    .filter((section) => !hiddenSections.has(section.id))
    .reduce((sum, section) => sum + section.found, 0)

  // The list is live data: a fresh answer can drop the cursor out of
  // range entirely, so clamp during render instead of through an effect.
  const cursorIndex =
    activeIndex == null ? null : rows.length === 0 ? null : Math.min(activeIndex, rows.length - 1)

  const activeRow = cursorIndex == null ? null : rows[cursorIndex]
  const activeId = activeRow ? `${inputId}-row-${activeRow.id}` : undefined

  const { listRef, fillTarget } = useCursorFill(inputId, activeRow)
  useSlashFocus(inputRef)

  // The facet a row belongs to: its own section id, or, for course rows,
  // the course-type facet the hit's courseType value lands in.
  const sectionOfRow = (row: SearchRow) => {
    const direct = sections.find((entry) => entry.id === row.sectionId)
    if (direct || row.sectionId !== 'courses') return direct
    const type = typeof row.hit.courseType === 'string' ? row.hit.courseType : ''
    return sections.find((entry) => entry.typeValue === type)
  }

  // Once the panel settles, the field owns focus, for typing or editing.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  function handleContainerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // While the reader types in the field, j and k are letters and Home
    // and End belong to the caret; the arrows still step into the list
    // from there, like any combobox.
    const target = event.target as HTMLElement | null
    const typing =
      target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable || false
    if (typing && (event.key === 'j' || event.key === 'k' || event.key === 'Home' || event.key === 'End')) {
      return
    }
    if (event.key === 'ArrowDown' || (!typing && event.key === 'j')) {
      event.preventDefault()
      setActiveIndex((index) => (rows.length ? Math.min((index ?? -1) + 1, rows.length - 1) : null))
    } else if (event.key === 'ArrowUp' || (!typing && event.key === 'k')) {
      event.preventDefault()
      // Arrow up on the first result returns to the query.
      setActiveIndex((index) => (rows.length ? Math.max((index ?? 0) - 1, 0) : null))
      if (cursorIndex === 0 && (event.key === 'ArrowUp' || event.key === 'k')) {
        setActiveIndex(null)
        inputRef.current?.focus()
      }
    } else if (!typing && event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(rows.length ? 0 : null)
    } else if (!typing && event.key === 'End') {
      event.preventDefault()
      setActiveIndex(rows.length ? rows.length - 1 : null)
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Enter or Space on a row opens it; Enter in the query runs the
      // best match when nothing is carried yet.
      if (activeRow) {
        event.preventDefault()
        onOpen(activeRow)
      }
    } else if (event.key === 'Escape') {
      if (query) {
        event.preventDefault()
        onQueryChange('')
        setActiveIndex(null)
        inputRef.current?.focus()
      } else {
        event.preventDefault()
        onEscape()
      }
    }
    document.getElementById(activeId ?? '')?.scrollIntoView({ block: 'nearest' })
  }

  return (
    <div
      tabIndex={-1}
      onKeyDown={handleContainerKeyDown}
      className="flex h-full w-full flex-col overflow-hidden bg-popover/98 text-popover-foreground outline-none [&_mark]:rounded-[5px] [&_mark]:bg-muted [&_mark]:px-0.75 [&_mark]:py-0.5 [&_mark]:font-semibold [&_mark]:text-foreground"
    >
      <SearchQueryBar
        query={query}
        onQueryChange={(value) => {
          onQueryChange(value)
          setActiveIndex(null)
        }}
        inputId={inputId}
        inputRef={inputRef}
        activeId={activeId}
        hasRows={rows.length > 0}
        sections={sections}
        hiddenSections={hiddenSections}
        onToggleSection={onToggleSection}
        onClearFilters={onClearFilters}
        filtersDirty={filtersDirty}
        totalFound={totalFound}
        onEscape={onEscape}
      />

      <div className="flex min-h-0 flex-1">
        <FiltersSidebar
          sections={sections}
          hiddenSections={hiddenSections}
          onToggleSection={onToggleSection}
          onClearFilters={onClearFilters}
          filtersDirty={filtersDirty}
        />

        <div className="flex min-w-0 flex-1 flex-col" aria-busy={searching}>
          <ResultsHeader
            locale={locale}
            searching={searching}
            seconds={seconds}
            totalFound={totalFound}
            sort={sort}
            onSortChange={onSortChange}
          />

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {rows.length === 0 ? (
              <SearchEmptyState searching={searching} query={query} />
            ) : (
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Search results"
                className="relative flex flex-col gap-1 px-4 py-4"
              >
                {/* The gliding cursor fill; reduced motion falls back. */}
                <div
                  ref={fillTarget}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 top-0 rounded-2xl bg-muted/60 opacity-0 transition-[transform,height,opacity] duration-150 motion-reduce:transition-none"
                />
                {rows.map((row, index) => (
                  <SearchRowItem
                    key={row.id}
                    row={row}
                    index={index}
                    section={sectionOfRow(row)}
                    active={cursorIndex === index}
                    locale={locale}
                    inputId={inputId}
                    onHover={setActiveIndex}
                    onOpen={onOpen}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
