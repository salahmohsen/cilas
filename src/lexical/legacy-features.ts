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

export const emailBlocksFeature = () =>
  withClient(
    BlocksFeature({ blocks: [Columns, PersonProfile, Movie, Gallery], inlineBlocks: [Mention] }),
    '/lexical/legacy-features.client#EmailBlocksFeatureClient',
  )
