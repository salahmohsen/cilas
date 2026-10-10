import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { httpUrl } from '@/fields/validators'

/** Coverage of CILAS by an outside outlet (CONTEXT.md). */
export const Press: CollectionConfig = {
  slug: 'press',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'outlet', 'published_date', 'kind'],
  },
  defaultSort: '-published_date',
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'coverage',
      options: [
        { label: 'Coverage', value: 'coverage' },
        { label: 'Interview', value: 'interview' },
        { label: 'Talk', value: 'talk' },
        { label: 'Op-ed', value: 'op_ed' },
      ],
      admin: { position: 'sidebar' },
    },
    // As published, in its own language; never translated.
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'language',
          type: 'select',
          options: [...LANGUAGE_OPTIONS],
          admin: { width: '30%' },
        },
        { name: 'outlet', type: 'relationship', relationTo: 'partners', admin: { width: '70%' } },
      ],
    },
    {
      name: 'authors',
      type: 'array',
      admin: { description: 'A person with a profile, or just a name.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'person', type: 'relationship', relationTo: 'people', admin: { width: '50%' } },
            {
              name: 'name',
              type: 'text',
              admin: { width: '50%' },
              validate: (value: unknown, { siblingData }: { siblingData: Record<string, unknown> }) =>
                value || siblingData.person ? true : 'Pick a person or type a name.',
            },
          ],
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'published_date',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayOnly' } },
        },
        {
          name: 'date_precision',
          type: 'select',
          defaultValue: 'day',
          options: [
            { label: 'Day', value: 'day' },
            { label: 'Month', value: 'month' },
            { label: 'Year', value: 'year' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'links',
      type: 'array',
      minRows: 1,
      admin: { description: 'One per language the piece appeared in.' },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'language',
              type: 'select',
              options: [...LANGUAGE_OPTIONS],
              admin: { width: '20%' },
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              validate: httpUrl,
              admin: { width: '40%' },
            },
            {
              // Wayback copy, shown when the original is gone.
              name: 'archived_url',
              type: 'text',
              validate: (value: unknown) => (value ? httpUrl(value) : true),
              admin: { width: '40%' },
            },
          ],
        },
      ],
    },
    { name: 'excerpt', type: 'textarea', localized: true },
  ],
}
