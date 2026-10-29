import { BlocksFeature, type FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { Columns } from '@/blocks/columns'
import { PersonProfile } from '@/blocks/person-profile'
import { Movie } from '@/blocks/movie'
import { Gallery } from '@/blocks/gallery'
import { RelatedContent } from '@/blocks/related-content'
import { Mention } from '@/blocks/mention'
import { legacyRelationshipFeature } from '@/lexical/legacy-features'

export const defaultEditorFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: FeatureProviderServer[]
}) => [
  ...defaultFeatures.filter((feature) => feature.key !== 'relationship'),
  legacyRelationshipFeature(),
  BlocksFeature({
    blocks: [Columns, PersonProfile, Movie, Gallery, RelatedContent],
    inlineBlocks: [Mention],
  }),
]
