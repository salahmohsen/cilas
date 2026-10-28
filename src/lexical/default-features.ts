import { BlocksFeature, type FeatureProviderServer } from '@payloadcms/richtext-lexical'

import { Columns } from '@/blocks/columns'
import { PersonProfile } from '@/blocks/person-profile'
import { Movie } from '@/blocks/movie'
import { Gallery } from '@/blocks/gallery'

export const defaultEditorFeatures = ({
  defaultFeatures,
}: {
  defaultFeatures: FeatureProviderServer[]
}) => [...defaultFeatures, BlocksFeature({ blocks: [Columns, PersonProfile, Movie, Gallery] })]
