import type { CollectionConfig } from 'payload'

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
    {
      name: 'kind',
      type: 'select',
      options: [{ label: 'Bridge Programme', value: 'BRIDGE' }],
    },
    { name: 'academic_year', type: 'text' }, // e.g. "2025–2026"
    { name: 'cycles', type: 'relationship', relationTo: 'cycles', hasMany: true }, // ordered: fall → spring
    {
      name: 'tuition',
      type: 'group',
      fields: [
        { name: 'amount', type: 'number' }, // 18,000
        { name: 'installments', type: 'number' }, // 3
        { name: 'need_based_deductions', type: 'checkbox' },
      ],
    },
    { name: 'weekly_hours', type: 'number' }, // ≥15
    { name: 'admission_requirements', type: 'richText', localized: true },
    { name: 'self_directed_study', type: 'checkbox' }, // between the two semesters
    { name: 'registration_form', type: 'relationship', relationTo: 'forms' }, // open for registration
  ],
  admin: {
    useAsTitle: "title"
  }
}
