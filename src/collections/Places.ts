import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { optionalHttpUrl } from '@/fields/validators'
import { anyone, isAdmin } from '../access'
import { importFields } from '@/fields/import'
import { revalidateAfterChange, revalidateAfterDelete } from '@/lib/revalidate'

/** A physical site where CILAS has taught (CONTEXT.md: Place; ADR 0007). */
export const Places: CollectionConfig = {
  slug: 'places',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    afterChange: [revalidateAfterChange('places')],
    afterDelete: [revalidateAfterDelete('places')],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    // Places have no `title`; the name is the human-readable label.
    slugField({ useAsSlug: 'name' }),
    {
      // Not a visibility tier — whether the place is still in use. Renamed from
      // `status` so it is never confused with Payload's `_status`.
      name: 'state',
      type: 'select',
      options: [
        { label: 'Current', value: 'current' },
        { label: 'Former', value: 'former' },
      ],
    },
    { name: 'city', type: 'text', localized: true }, // names the place's cycles: "Spring 2026, Cairo"
    {
      name: 'address',
      type: 'text',
      localized: true,
      admin: {
        description:
          'The street address, e.g. “10 Darb El Labana, El Darb El Ahmar, Cairo 11311, Egypt”.',
      },
    },
    {
      name: 'map_url',
      label: 'Google Maps link',
      type: 'text',
      validate: optionalHttpUrl,
      admin: { description: 'Shown with the address, e.g. in the emails’ footer.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'opened_year', type: 'number', min: 2012, max: 2100, admin: { width: '50%' } },
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
  },
}
