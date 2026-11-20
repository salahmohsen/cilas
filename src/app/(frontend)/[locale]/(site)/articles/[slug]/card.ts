import { cardWords, ogCardRoute } from '@/lib/og-card'

import { articleMetadata } from './metadata'

/**
 * An article's share card, from the public page's metadata: the signed-in
 * page draws the same card, and a community article gets none.
 */
export const articleCard = ogCardRoute(
  (params: { locale: string; slug: string }) => articleMetadata({ ...params, user: null }),
  cardWords({ en: { label: 'Article', action: 'Read' }, ar: { label: 'مقال', action: 'اقرأ' } }),
)
