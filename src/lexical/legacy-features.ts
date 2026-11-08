import {
  BlocksFeature,
  RelationshipFeature,
  type FeatureProviderServer,
} from '@payloadcms/richtext-lexical'
import { Columns } from '@/blocks/columns'
import { PersonProfile } from '@/blocks/person-profile'
import { Movie } from '@/blocks/movie'
import { Gallery } from '@/blocks/gallery'
import { Mention } from '@/blocks/mention'
import { CardStack } from '@/blocks/card-stack'
import { Footnote } from '@/blocks/footnote'
import { RelatedContent } from '@/blocks/related-content'
import { NewsletterImage, NewsletterPicks, NewsletterQuote } from '@/blocks/newsletter-blocks'

const withClient = <P, S, C>(
  provider: FeatureProviderServer<P, S, C>,
  ClientFeature: string,
): FeatureProviderServer<P, S, C> => {
  const feature = provider.feature
  return {
    ...provider,
    feature: async (args) => ({
      ...(typeof feature === 'function' ? await feature(args) : feature),
      ClientFeature,
    }),
  }
}

export const legacyRelationshipFeature = () =>
  withClient(
    RelationshipFeature(),
    '/lexical/legacy-features.client#LegacyRelationshipFeatureClient',
  )

export const contentBlocksFeature = (kind: 'default' | 'article' | 'email') =>
  BlocksFeature({
    blocks: [
      ...(kind === 'article' ? [CardStack] : []),
      Columns,
      PersonProfile,
      Movie,
      Gallery,
      ...(kind === 'email'
        ? [NewsletterImage, NewsletterPicks, NewsletterQuote]
        : [RelatedContent]),
    ],
    inlineBlocks: [...(kind === 'article' ? [Footnote] : []), Mention],
  })

export const emailBlocksFeature = () =>
  withClient(
    contentBlocksFeature('email'),
    '/lexical/legacy-features.client#EmailBlocksFeatureClient',
  )
