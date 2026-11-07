import { cardWords, ogCardRoute } from '@/lib/og-card'

import { courseMetadata } from './course-page'

/**
 * A course's share card, from the public page's metadata: the signed-in
 * page draws the same card, and a community course gets none.
 */
export const courseCard = ogCardRoute(
  ({ locale, slug }: { locale: string; slug: string }) => courseMetadata(locale, slug, null),
  cardWords({
    en: { label: 'Course', action: 'Learn more' },
    ar: { label: 'دورة', action: 'اعرف المزيد' },
  }),
)
