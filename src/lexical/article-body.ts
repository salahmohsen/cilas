import { type FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { contentBlocksFeature, legacyRelationshipFeature } from '@/lexical/legacy-features'

/**
 * The article body's editor, as features: also given to the markdown
 * converters (src/lib/llms-document.ts), which must know the same nodes.
 */
export const articleBodyFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: FeatureProviderServer[]
}) => [
  ...defaultFeatures.filter((feature) => feature.key !== 'relationship'),
  legacyRelationshipFeature(),
  contentBlocksFeature('article'),
]
