import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { anyone, isAdmin } from '../access'

export const Spaces: CollectionConfig = {
  slug: 'spaces',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    // Spaces have no `title`; the name is the human-readable label.
    slugField({ useAsSlug: 'name' }),
    {
      // Not a visibility tier — whether the space is still in use. Renamed from
      // `status` so it is never confused with Payload's `_status`.
      name: 'state',
      type: 'select',
      options: [
        { label: 'Current', value: 'current' },
        { label: 'Former', value: 'former' },
      ],
    },
    {
      label: 'Description',
      type: 'group',
      fields: [
        { name: 'description', type: 'richText', localized: true },
        {
          name: 'images',
          type: 'array',
          fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
        },
      ],
    },
  ],
  admin: {
    useAsTitle: 'name',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
}
