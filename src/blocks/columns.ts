import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import type { Block, Field } from 'payload'

import { PersonProfile } from './person-profile'
import { Movie } from './movie'
import { Gallery } from './gallery'
import { RelatedContent } from './related-content'
import { Mention } from './mention'
import { legacyRelationshipFeature } from '@/lexical/legacy-features'

export const Columns: Block = {
  slug: 'columns',
  interfaceName: 'ColumnsBlock',
  labels: { singular: 'Columns', plural: 'Columns' },
  fields: [
    {
      name: 'columnCount',
      label: 'Number of columns',
      type: 'select',
      defaultValue: '2',
      options: [
        { label: 'Two', value: '2' },
        { label: 'Three', value: '3' },
        { label: 'Four', value: '4' },
      ],
      admin: { description: 'Four columns become two on tablets and one on phones.' },
    },
    {
      name: 'ratio',
      type: 'select',
      required: true,
      defaultValue: 'equal',
      options: [
        { label: 'Equal widths', value: 'equal' },
        { label: 'Narrow first column', value: 'oneThird' },
        { label: 'Wide first column', value: 'twoThirds' },
      ],
      admin: { condition: (_, sibling) => !sibling?.columnCount || sibling.columnCount === '2' },
    },
    {
      type: 'row',
      fields: ['first', 'second', 'third', 'fourth'].map((name, index): Field => ({
        name,
        label: `${['First', 'Second', 'Third', 'Fourth'][index]} column`,
        type: 'richText',
        required: index < 2,
        editor: lexicalEditor({
          features: ({ defaultFeatures }) => [
            ...defaultFeatures.filter((feature) => feature.key !== 'relationship'),
            legacyRelationshipFeature(),
            BlocksFeature({
              blocks: [PersonProfile, Movie, Gallery, RelatedContent],
              inlineBlocks: [Mention],
            }),
          ],
        }),
        admin: {
          width: '50%',
          description: 'Add text, an image, a gallery, a movie, or a Person profile block.',
          condition: (_, sibling) => index < Number(sibling?.columnCount ?? 2),
        },
      })),
    },
  ],
}
