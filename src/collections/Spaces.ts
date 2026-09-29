import type { CollectionConfig } from 'payload'

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
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Current', value: 'current' },
        { label: 'Former', value: 'former' },
      ],
    },
    { name: 'description', type: 'richText', localized: true },
    {
      name: 'images',
      type: 'array',
      fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
    },
  ],
  admin: {
    useAsTitle: 'name',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
}
