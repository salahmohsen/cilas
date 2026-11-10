import {
  BoldFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  UnorderedListFeature,
  ParagraphFeature,
  FixedToolbarFeature,
} from '@payloadcms/richtext-lexical'

export const questionDescriptionFeatures = () => [
  ParagraphFeature(),
  BoldFeature(),
  ItalicFeature(),
  LinkFeature({ enabledCollections: [] }),
  UnorderedListFeature(),
  OrderedListFeature(),
  FixedToolbarFeature(),
]
