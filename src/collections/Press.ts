import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { httpUrl, optionalHttpUrl } from '@/fields/validators'
import { importFields } from '@/fields/import'

/** Coverage of CILAS by an outside outlet (CONTEXT.md). */
export const Press: CollectionConfig = {
  slug: 'press',
  labels: { singular: 'Press item', plural: 'Press' },
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'published_date', 'kind'],
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
      admin: {
        description:
          'Coverage is written about CILAS; an interview, talk or op-ed is by someone from CILAS.',
        position: 'sidebar',
      },
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
      ],
    },
    {
      // The outlet that published it: its name, site and logo, shown in the
      // home page's press row.
      name: 'outlet',
      type: 'group',
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text', localized: true, admin: { width: '50%' } },
            {
              name: 'url',
              type: 'text',
              validate: optionalHttpUrl,
              admin: { width: '50%', placeholder: 'https://…' },
            },
          ],
        },
        { name: 'logo', type: 'upload', relationTo: 'media' },
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
              validate: (
                value: unknown,
                { siblingData }: { siblingData: Record<string, unknown> },
              ) => (value || siblingData.person ? true : 'Pick a person or type a name.'),
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
          admin: {
            description:
              'How exact the date is. Year when only the year is known, e.g. a 2016 talk.',
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'links',
      type: 'array',
      // Payload skips minRows on an empty array unless the field is required.
      required: true,
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
              admin: { width: '80%' },
            },
          ],
        },
      ],
    },
    { name: 'excerpt', type: 'textarea', localized: true },
    ...importFields(),
  ],
}
