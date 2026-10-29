import { BlocksFeature, type FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { CardStack } from '@/blocks/card-stack'
import { Columns } from '@/blocks/columns'
import { PersonProfile } from '@/blocks/person-profile'
import { Movie } from '@/blocks/movie'
import { Gallery } from '@/blocks/gallery'
import { Footnote } from '@/blocks/footnote'
import { RelatedContent } from '@/blocks/related-content'
import { Mention } from '@/blocks/mention'
import { legacyRelationshipFeature } from '@/lexical/legacy-features'

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
  BlocksFeature({
    blocks: [CardStack, Columns, PersonProfile, Movie, Gallery, RelatedContent],
    inlineBlocks: [Footnote, Mention],
  }),
]
