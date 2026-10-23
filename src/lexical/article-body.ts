import { BlocksFeature } from '@payloadcms/richtext-lexical'

import { CardStack } from '@/blocks/card-stack'
import { Footnote } from '@/blocks/footnote'
import { Mention } from '@/blocks/mention'

/**
 * The article body's editor, as features: also given to the markdown
 * converters (src/lib/llms-document.ts), which must know the same nodes.
 */
export const articleBodyFeatures = ({ defaultFeatures }: { defaultFeatures: any[] }) => [
  ...defaultFeatures,
  BlocksFeature({ blocks: [CardStack], inlineBlocks: [Footnote, Mention] }),
]
