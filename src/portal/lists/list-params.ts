import type { Locale } from '@/i18n/routing'

import { clampPage, MAX_PAGES, MAX_SEARCH_CHARS, type Chip, type PagedGroup } from './groups'

/** What a list URL holds: the search, the chip, the page count of each paged group, and the Show more focus. */
export type ListParams = {
  q: string | null
  show: Chip | null
  pages: Partial<Record<PagedGroup, number>>
  focus: PagedGroup | null
}

export const DEFAULT_PARAMS: ListParams = { q: null, show: null, pages: {}, focus: null }

const CHIPS: readonly Chip[] = ['needsYou', 'drafts', 'published']

/** The URL name of each paged group's page count, in the order a URL writes them. */
const PAGE_PARAM: Record<PagedGroup, string> = {
  published: 'published',
  teachingNow: 'teaching',
  closed: 'closed',
}
const PAGED_GROUPS = Object.keys(PAGE_PARAM) as PagedGroup[]

type SearchParams = Record<string, string | string[] | undefined>

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const groupOfParam = (value: string | undefined) =>
  PAGED_GROUPS.find((group) => PAGE_PARAM[group] === value) ?? null

/** A page count above 1, or nothing: page 1 is the default and never sits in the URL. */
const pageOfParam = (value: string | undefined) => {
  const n = Number(value)
  if (value === undefined || value === '' || !Number.isInteger(n)) return undefined
  const page = clampPage(n)
  return page > 1 ? page : undefined
}

/** The list params of a request, each parsed to a fixed value set. */
export const parseListParams = (searchParams: SearchParams): ListParams => {
  const q = (first(searchParams.q) ?? '').trim().slice(0, MAX_SEARCH_CHARS)
  const show = first(searchParams.show)
  const pages: ListParams['pages'] = {}
  for (const group of PAGED_GROUPS) {
    const page = pageOfParam(first(searchParams[PAGE_PARAM[group]]))
    if (page) pages[group] = page
  }
  return {
    q: q === '' ? null : q,
    show: CHIPS.find((chip) => chip === show) ?? null,
    pages,
    focus: groupOfParam(first(searchParams.focus)),
  }
}

/**
 * The one place that builds a list URL: the locale prefix (`localePrefix`
 * is `always`), then each param that is not its default, in a fixed order.
 */
export const hrefOf = (path: string, params: ListParams, locale: Locale): string => {
  const query = new URLSearchParams()
  if (params.q !== null) query.set('q', params.q)
  if (params.show !== null) query.set('show', params.show)
  for (const group of PAGED_GROUPS) {
    const page = params.pages[group]
    if (page && page > 1) query.set(PAGE_PARAM[group], String(page))
  }
  if (params.focus !== null) query.set('focus', PAGE_PARAM[params.focus])
  const search = query.toString()
  return `/${locale}${path}${search ? `?${search}` : ''}`
}

/** Chips and search show above 6 rows, and also under a search or a chip so the reader can go back (Deviation 18). */
export const controlsShown = (total: number, params: ListParams): boolean =>
  total > 6 || (total > 0 && (params.q !== null || params.show !== null))

/** The page count Show more asks for, or null when the group already shows `MAX_PAGES`. */
export const nextPages = (params: ListParams, group: PagedGroup): number | null => {
  const page = params.pages[group] ?? 1
  return page < MAX_PAGES ? page + 1 : null
}

/** What ends a paged group that has more rows: Show more, or the cap line that fits the reader's search. */
export const moreKindOf = (
  params: ListParams,
  group: PagedGroup,
): 'link' | 'pageCap' | 'pageCapSearch' => {
  if (nextPages(params, group) !== null) return 'link'
  return params.q !== null ? 'pageCapSearch' : 'pageCap'
}
