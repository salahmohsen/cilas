import { cardWords, ogCardRoute } from '@/lib/og-card'

import { bridgeMetadata } from './metadata'

const card = ogCardRoute(
  ({ locale }: { locale: string }) => bridgeMetadata(locale),
  cardWords({
    en: { label: 'Programme', action: 'Learn more' },
    ar: { label: 'برنامج', action: 'اعرف المزيد' },
  }),
)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
