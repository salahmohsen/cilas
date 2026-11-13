import { getTranslations } from 'next-intl/server'
import { getPayload } from 'payload'

import { getHomeHero } from '@/api/home.api'
import type { Locale } from '@/i18n/routing'
import { ogCardRoute } from '@/lib/og-card'
import config from '@/payload.config'

import { siteCardWords } from '../site-card'

// Editors change the description in Site Settings; same pace as the page.
export const revalidate = 300

// The home page's card: the institute's full name, and the hero's description
// in the boat's place.
const card = ogCardRoute(
  async ({ locale }: { locale: string }) => {
    const t = await getTranslations({ locale, namespace: 'Home' })
    return { title: t('metaTitle') }
  },
  async (locale) => ({
    ...siteCardWords(locale),
    description: (await getHomeHero(await getPayload({ config }), locale as Locale)).description,
  }),
)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
