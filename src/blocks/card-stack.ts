import type { Block } from 'payload'

/**
 * A fan of cards inside an article's text (the orbit card stack): an article
 * collection's articles, chosen articles or courses, or a cycle's courses.
 * The site shows only published, public items, and a list on phones.
 */
export const CardStack: Block = {
  slug: 'cardStack',
  interfaceName: 'CardStackBlock',
  labels: { singular: 'Card stack', plural: 'Card stacks' },
  fields: [
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'publication',
      options: [
        { label: 'An article collection (all its articles)', value: 'publication' },
        { label: 'Chosen articles', value: 'articles' },
        { label: 'Chosen courses', value: 'courses' },
        { label: 'A cycle (all its courses)', value: 'cycle' },
      ],
    },
    {
      name: 'publication',
      label: 'Article collection',
      type: 'relationship',
      relationTo: 'publications',
      admin: { condition: (_, s) => s?.source === 'publication' },
    },
    {
      name: 'articles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: { condition: (_, s) => s?.source === 'articles', description: 'In the order the stack shows them.' },
    },
    {
      name: 'courses',
      type: 'relationship',
      relationTo: 'courses',
      hasMany: true,
      admin: { condition: (_, s) => s?.source === 'courses', description: 'In the order the stack shows them.' },
    },
    {
      name: 'cycle',
      type: 'relationship',
      relationTo: 'cycles',
      admin: { condition: (_, s) => s?.source === 'cycle' },
    },
    {
      name: 'label',
      type: 'text',
      localized: true,
      admin: { description: 'Read out to screen readers, e.g. “Essays in this collection”. Empty: a label from the source.' },
    },
  ],
}
