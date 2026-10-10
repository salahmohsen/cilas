/**
 * Where a document lives on the public site, or null when its collection has
 * no page yet. Add a line here as each frontend route lands.
 */
export const pathOf = (collection: string, doc: { slug?: string | null }): string | null => {
  if (!doc.slug) return null
  switch (collection) {
    case 'courses':
      return `/study/${doc.slug}`
    default:
      return null
  }
}
