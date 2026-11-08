import { ogCardRoute } from '@/lib/og-card'

import { siteCardTitle, siteCardWords } from './site-card'

// The site's card, for every page that draws none of its own: the name,
// and the CILAS boat in the image's place.
const card = ogCardRoute(siteCardTitle, siteCardWords)

export const generateImageMetadata = card.generateImageMetadata
export default card.Image
