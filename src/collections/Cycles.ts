import type { CollectionConfig } from 'payload'

import { anyone, isAdmin } from '../access'

export const Cycles: CollectionConfig = {
  slug: 'cycles',
  access: {
    read: anyone,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'label', type: 'text' }, // "Spring Semester 2026"
    {
      name: 'season',
      type: 'select',
      options: ['fall', 'winter', 'spring', 'summer'].map((s) => ({ label: s, value: s })),
    },
    { name: 'year', type: 'number' },
    {
      name: 'mode',
      type: 'select',
      options: [
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Hybrid', value: 'HYBRID' },
      ],
    },
    { name: 'courses', type: 'relationship', relationTo: 'courses', hasMany: true },
  ],
  admin: {
    useAsTitle: 'label',
  },
}
