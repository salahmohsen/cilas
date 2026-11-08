import type { Block, Field } from 'payload'

import { PICK_TYPES } from '@/emails/pick-types'

export const NewsletterImage: Block = {
  slug: 'newsletterImage',
  interfaceName: 'NewsletterImageBlock',
  labels: { singular: 'Image', plural: 'Images' },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { contains: 'image/' } },
    },
    { name: 'caption', type: 'text', admin: { description: 'Shown under the image.' } },
  ],
}

export const NewsletterPicks: Block = {
  slug: 'newsletterPicks',
  interfaceName: 'NewsletterPicksBlock',
  labels: { singular: 'Picks', plural: 'Picks' },
  fields: [
    { name: 'heading', type: 'text' },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Pick', plural: 'Picks' },
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          defaultValue: 'course',
          options: PICK_TYPES.map(({ value, label }) => ({ value, label })),
          admin: { description: 'Choose the type first; the next field lists only that type.' },
        },
        ...PICK_TYPES.map(({ value, label, relationTo, filter }): Field => ({
          name: value,
          label,
          type: 'relationship',
          relationTo,
          ...(filter ? { filterOptions: () => filter } : {}),
          admin: { condition: (_, sibling) => sibling?.type === value },
          validate: (v: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
            siblingData?.type !== value || v ? true : `Choose the ${label.toLowerCase()}.`,
        })),
        {
          name: 'note',
          type: 'text',
          admin: { description: 'One line under the card, e.g. “Applications close 3 Nov”.' },
        },
      ],
    },
  ],
}

export const NewsletterQuote: Block = {
  slug: 'newsletterQuote',
  interfaceName: 'NewsletterQuoteBlock',
  labels: { singular: 'Quote', plural: 'Quotes' },
  fields: [
    { name: 'text', type: 'textarea', required: true },
    {
      name: 'attribution',
      type: 'text',
      admin: { description: 'Who said it, e.g. “Ghosoun Ismail, fellow”.' },
    },
  ],
}
