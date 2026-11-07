import { type FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { contentBlocksFeature, legacyRelationshipFeature } from '@/lexical/legacy-features'

export const defaultEditorFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: FeatureProviderServer[]
}) => [
  ...defaultFeatures.filter((feature) => feature.key !== 'relationship'),
  legacyRelationshipFeature(),
  contentBlocksFeature('default'),
]
