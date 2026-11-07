import { getTranslations } from 'next-intl/server'

import { cardWords, ogCardRoute } from '@/lib/og-card'

// The site's card, for every page that draws none of its own: the name,
// and the CILAS boat in the image's place.
const card = ogCardRoute(
  async ({ locale }: { locale: string }) => {
    const t = await getTranslations({ locale, namespace: 'Meta' })
    return { title: t('siteName') }
  },
  cardWords({ en: { action: 'Visit' }, ar: { action: 'زُر الموقع' } }),
)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
