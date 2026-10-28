import { BlocksFeature, type FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { CardStack } from '@/blocks/card-stack'
import { Columns } from '@/blocks/columns'
import { PersonProfile } from '@/blocks/person-profile'
import { Movie } from '@/blocks/movie'
import { Gallery } from '@/blocks/gallery'
import { Footnote } from '@/blocks/footnote'
import { Mention } from '@/blocks/mention'

/**
 * The article body's editor, as features: also given to the markdown
 * converters (src/lib/llms-document.ts), which must know the same nodes.
 */
export const articleBodyFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: FeatureProviderServer[]
}) => [
  ...defaultFeatures,
  BlocksFeature({
    blocks: [CardStack, Columns, PersonProfile, Movie, Gallery],
    inlineBlocks: [Footnote, Mention],
  }),
]
