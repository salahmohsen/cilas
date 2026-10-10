import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '@/access'
import { slugField } from '@/fields/slug'
import { httpUrl } from '@/fields/validators'
import { importFields } from '@/fields/import'

/** An outside organisation CILAS works with: funders, co-hosts, press outlets. */
export const Partners: CollectionConfig = {
  slug: 'partners',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'url'],
  },
  fields: [
    { name: 'name', type: 'text', required: true, localized: true },
    slugField({ useAsSlug: 'name' }),
    {
      // One organisation can be both, e.g. a funder that co-hosts an event.
      name: 'kind',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        { label: 'Funder', value: 'funder' },
        { label: 'Co-host', value: 'co_host' },
        { label: 'Press outlet', value: 'outlet' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'url',
      type: 'text',
      validate: (value: unknown) => (value ? httpUrl(value) : true),
      admin: { placeholder: 'https://…' },
    },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    ...importFields(),
  ],
}
