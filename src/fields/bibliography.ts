import type { ArrayField } from 'payload'

const MATERIAL_TYPES = ['reading', 'watch', 'listen', 'prompt', 'other'] as const

/** Materials a session or course asks people to engage with (CONTEXT.md). */
export const bibliographyField = (label?: string): ArrayField => ({
  name: 'bibliography',
  type: 'array',
  ...(label ? { label } : {}),
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: MATERIAL_TYPES.map((value) => ({
        label: value.charAt(0).toUpperCase() + value.slice(1),
        value,
      })),
    },
    { name: 'title', type: 'text', localized: true, index: true },
    { name: 'href', type: 'text' }, // youtube / vimeo / article url
    { name: 'note', type: 'text', localized: true }, // author, year, pages; primary vs secondary reading
  ],
})
