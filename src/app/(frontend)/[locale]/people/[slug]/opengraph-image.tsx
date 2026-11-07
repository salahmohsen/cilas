import { cardWords, ogCardRoute } from '@/lib/og-card'

import { personMetadata } from './metadata'

const card = ogCardRoute(
  ({ locale, slug }: { locale: string; slug: string }) => personMetadata(locale, slug),
  cardWords({
    en: { label: 'Profile', action: 'View profile' },
    ar: { label: 'ملف شخصي', action: 'عرض الملف' },
  }),
)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
