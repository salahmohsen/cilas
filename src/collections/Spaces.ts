import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { anyone, isAdmin } from '../access'
import { importFields } from '@/fields/import'
import {
  revalidateCoursesAfterChange,
  revalidateCoursesAfterDelete,
} from '@/lib/revalidate-courses'

export const Spaces: CollectionConfig = {
  slug: 'spaces',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  // Its names show in the cached study list.
  hooks: {
    afterChange: [revalidateCoursesAfterChange],
    afterDelete: [revalidateCoursesAfterDelete],
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
    { name: 'city', type: 'text', localized: true }, // names the space's cycles: "Spring 2026, Cairo"
    {
      type: 'row',
      fields: [
        { name: 'opened_year', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
        // Empty while in use.
        { name: 'closed_year', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
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
    ...importFields(),
  ],
  admin: {
    useAsTitle: 'name',
    hidden: (ctx) => !ctx.user?.roles.includes('super_admin') && !ctx.user?.roles.includes('admin'),
  },
}
