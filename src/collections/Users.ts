import { isAdmin } from '@/access'
import type { CollectionConfig } from 'payload'

// The plan's `people` collection — auth users of the community.
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    update: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', localized: true },
    { name: 'photo', type: 'upload', relationTo: 'media' },
    { name: 'bio', type: 'richText', localized: true }, // single source of truth
    {
      name: 'roles',
      type: 'select',
      required: true,
      defaultValue: 'ciliasian',
      hasMany: true,
      options: [
        { label: 'Super Admin', value: 'super_admin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Fellow', value: 'fellow' },
        { label: 'CILASian', value: 'ciliasian' },
        { label: 'Non-Degree-Seeking Student', value: 'non_degree_seeking' },
      ],
    },
    {
      name: 'field_of_study',
      type: 'relationship',
      relationTo: 'fields-of-study',
      admin: { condition: (d) => d.roles?.includes('fellow') },
    },
    {
      name: 'cohort_year',
      type: 'text',
      admin: { condition: (d) => d.roles?.includes('ciliasian') },
    }, // "CILASians 2016–2017"
    {
      name: 'courses',
      type: 'relationship',
      relationTo: 'courses',
      hasMany: true,
      admin: { condition: (d) => d.roles?.includes('fellow') },
    },
  ],
}
