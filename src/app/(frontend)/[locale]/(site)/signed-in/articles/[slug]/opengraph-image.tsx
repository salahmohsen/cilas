import { articleCard } from '../../../articles/[slug]/card'

// The public page's card (src/proxy.ts sends a signed-in reader here).
export const generateImageMetadata = articleCard.generateImageMetadata
export default articleCard.Image
