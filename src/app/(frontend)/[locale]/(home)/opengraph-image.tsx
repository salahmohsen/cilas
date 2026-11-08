import { getPayload } from 'payload'

import { getHomeHeroDescription } from '@/api/home.api'
import type { Locale } from '@/i18n/routing'
import { ogCardRoute } from '@/lib/og-card'
import config from '@/payload.config'

import { siteCardTitle, siteCardWords } from '../site-card'

// Editors change the description in Site Settings; same pace as the page.
export const revalidate = 300

// The home page's card: the site's, with the hero's description in the boat's place.
const card = ogCardRoute(siteCardTitle, async (locale) => ({
  ...siteCardWords(locale),
  description: await getHomeHeroDescription(await getPayload({ config }), locale as Locale),
}))

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
