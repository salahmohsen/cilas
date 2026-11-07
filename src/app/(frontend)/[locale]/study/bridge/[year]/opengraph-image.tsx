import { cardWords, ogCardRoute } from '@/lib/og-card'

import { bridgeYearMetadata } from './metadata'

const card = ogCardRoute(
  ({ locale, year }: { locale: string; year: string }) => bridgeYearMetadata(locale, year),
  cardWords({
    en: { label: 'Programme', action: 'Learn more' },
    ar: { label: 'برنامج', action: 'اعرف المزيد' },
  }),
)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
