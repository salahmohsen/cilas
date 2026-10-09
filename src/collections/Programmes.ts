import type { CollectionConfig } from 'payload'

import { slugField } from '@/fields/slug'
import { anyone, isAdmin } from '../access'

export const Programmes: CollectionConfig = {
  slug: 'programmes',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    slugField(),
    {
      label: 'Structure',
      type: 'group',
      fields: [
        { name: 'cycles', type: 'relationship', relationTo: 'cycles', hasMany: true }, // ordered: fall → spring
        { name: 'self_directed_study', type: 'checkbox' }, // between the two semesters
      ],
    },
    {
      label: 'Requirements',
      type: 'group',
      fields: [
        { name: 'weekly_hours', type: 'number' }, // ≥15
        { name: 'admission_requirements', type: 'richText', localized: true },
      ],
    },
    {
      label: 'Tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' }, // 18,000
        { name: 'installments', type: 'number' }, // 3
        { name: 'need_based_deductions', type: 'checkbox' },
      ],
    },
    {
      label: 'Registration',
      type: 'group',
      fields: [{ name: 'registration_form', type: 'relationship', relationTo: 'forms' }], // open for registration
    },
  ],
  admin: {
    useAsTitle: 'title',
  },
}
