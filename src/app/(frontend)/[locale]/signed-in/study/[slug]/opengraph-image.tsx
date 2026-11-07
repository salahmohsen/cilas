import { courseCard } from '../../../study/[slug]/card'

// The public page's card (src/proxy.ts sends a signed-in reader here).
export const generateImageMetadata = courseCard.generateImageMetadata
export default courseCard.Image
