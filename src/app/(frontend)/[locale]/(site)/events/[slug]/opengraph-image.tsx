import type { Locale } from '@/i18n/routing'
import { cardWords, ogCardRoute } from '@/lib/og-card'

import { eventMetadata } from './metadata'

const card = ogCardRoute(
  async ({ locale, slug }: { locale: Locale; slug: string }) =>
    (await eventMetadata(locale, slug)) ?? {},
  cardWords({
    en: { label: 'Event', action: 'See details' },
    ar: { label: 'فعالية', action: 'التفاصيل' },
  }),
)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
