import type { Locale } from '@/i18n/routing'

import type { ReviewedCollection } from './reviewed-fields'

/**
 * Where a reviewed document opens for a viewer. In 1b every viewer gets the
 * admin URL, a locale-free path. Callers pass every input now so that phase 2
 * adds the portal branches with no caller change.
 */
export const documentHref = ({
  collection,
  id,
}: {
  collection: ReviewedCollection
  id: number
  viewer: 'owner' | 'admin' | 'fellow'
  waiting: boolean
  locale: Locale
}): string => `/admin/collections/${collection}/${id}`

/** The admin page that creates a document. */
export const adminCreateHref = (collection: ReviewedCollection): string =>
  `/admin/collections/${collection}/create`
