import { LinkFeature, type FeatureProviderServer } from '@payloadcms/richtext-lexical'
import { emailBlocksFeature, legacyRelationshipFeature } from '@/lexical/legacy-features'

export const emailEditorFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: FeatureProviderServer[]
}) => [
  ...defaultFeatures.filter(
    (feature) => !['relationship', 'link', 'align', 'indent', 'checklist'].includes(feature.key),
  ),
  LinkFeature({ enabledCollections: [] }),
  legacyRelationshipFeature(),
  emailBlocksFeature(),
]
