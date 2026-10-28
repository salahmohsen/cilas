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
