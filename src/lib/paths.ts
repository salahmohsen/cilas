/** Where a document lives, without the site language. */
const pagePath = (collection: string, slug: string): string | null => {
  switch (collection) {
    case 'courses':
      return `/study/${slug}`
    case 'articles':
      return `/articles/${slug}`
    case 'events':
      return `/events/${slug}`
    case 'people':
      return `/people/${slug}`
    default:
      return null
  }
}

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

export const BRIDGE_APPLY_PATH = '/study/bridge/apply'

/** A Bridge year's page: `/study/bridge/2024-2025` for `bridge-programme-2024-2025`. */
export const bridgeYearPath = (slug: string) =>
  `/study/bridge/${slug.replace(/^bridge-programme-/, '')}`
/** The programme slug a year's page names. */
export const bridgeSlugOf = (year: string) => `bridge-programme-${year}`

/** The span and optional city encoded in a Bridge programme slug. */
export const bridgeYearParts = (slug: string) => {
  const [, span = slug, place] = /^bridge-programme-(\d{4}-\d{4})(?:-(.+))?$/.exec(slug) ?? []
  return { span, place }
}
