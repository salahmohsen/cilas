import type { Block } from 'payload'

export const RelatedContent: Block = {
  slug: 'relatedContent',
  interfaceName: 'RelatedContentBlock',
  labels: { singular: 'Related content', plural: 'Related content' },
  fields: [
    {
      name: 'document',
      type: 'relationship',
      relationTo: ['articles', 'courses', 'events', 'publications', 'programmes'],
      required: true,
      admin: { description: 'Shows a summary card with a link to the original content.' },
    },
  ],
}
