/**
 * What each collection shows on the public site, and so what a save drops from
 * the cache: its detail page (under the current and the previous slug), the
 * pages that list it (per language), fixed pages, and whether it feeds the
 * lists cached under `PUBLIC_LISTS_TAG`. Add a line as each frontend route lands.
 */
const ROUTES: Record<
  string,
  {
    detail?: (slug: string) => string
    lists?: readonly string[]
    fixed?: readonly string[]
    tag?: boolean
  }
> = {
  courses: { detail: (slug) => `/study/${slug}`, tag: true },
  articles: { detail: (slug) => `/articles/${slug}` },
  events: {
    detail: (slug) => `/events/${slug}`,
    lists: ['', '/events', '/calendar', '/signed-in'],
    fixed: ['/sitemap.xml'],
    tag: true,
  },
  people: { detail: (slug) => `/people/${slug}`, tag: true },
  cycles: { tag: true },
  places: { tag: true },
  media: { tag: true },
}

/**
 * The cache tag of the lists built from courses, cycles, people, places,
 * events and media (study, calendar, fellows). The string is kept as it was
 * when only courses fed it.
 */
export const PUBLIC_LISTS_TAG = 'courses'

/** Where a document lives, without the site language. */
const pagePath = (collection: string, slug: string): string | null =>
  ROUTES[collection]?.detail?.(slug) ?? null

/**
 * Where a document lives on the public site, or null when its collection has
 * no page yet. Add a line to `pagePath` as each frontend route lands. Every
 * public URL carries a site language (ADR 0006); without `locale` the path is
 * returned bare, for callers that add the language themselves.
 */
export const pathOf = (
  collection: string,
  doc: { slug?: string | null },
  locale?: string,
): string | null => {
  if (!doc.slug) return null
  const path = pagePath(collection, doc.slug)
  return path && locale ? `/${locale}${path}` : path
}

/** A known public route, including optional child pages. */
export const detailPath = (
  collection: 'courses' | 'articles' | 'events' | 'people',
  slug: string,
  locale?: string,
  child?: string,
): string => `${locale ? `/${locale}` : ''}${pagePath(collection, slug)}${child ? `/${child}` : ''}`

export const revalidationOf = (
  collection: string,
  locales: readonly string[],
  doc: { slug?: string | null },
  previousDoc?: { slug?: string | null } | null,
) => {
  const route = ROUTES[collection]
  const paths = new Set<string>(route?.fixed)
  for (const locale of locales) {
    for (const list of route?.lists ?? []) paths.add(`/${locale}${list}`)
    for (const source of [doc, previousDoc]) {
      const path = source ? pathOf(collection, source, locale) : null
      if (path) paths.add(path)
    }
  }
  return { paths: [...paths], tag: Boolean(route?.tag) }
}

export const BRIDGE_PATH = '/study/bridge'
export const BRIDGE_APPLY_PATH = `${BRIDGE_PATH}/apply`

/** A Bridge year's page: `/study/bridge/2024-2025` for `bridge-programme-2024-2025`. */
export const bridgeYearPath = (slug: string) =>
  `${BRIDGE_PATH}/${slug.replace(/^bridge-programme-/, '')}`
/** The programme slug a year's page names. */
export const bridgeSlugOf = (year: string) => `bridge-programme-${year}`

/** The span and optional city encoded in a Bridge programme slug. */
export const bridgeYearParts = (slug: string) => {
  const [, span = slug, place] = /^bridge-programme-(\d{4}-\d{4})(?:-(.+))?$/.exec(slug) ?? []
  return { span, place }
}
