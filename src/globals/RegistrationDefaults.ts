import type { GlobalConfig } from 'payload'

import { isAdmin } from '@/access'

export const RegistrationDefaults: GlobalConfig = {
  slug: 'registration-defaults',
  label: 'Registration defaults',
  access: { read: isAdmin, update: isAdmin },
  fields: [
    { name: 'cycle_template', label: 'Cycle template' },
    { name: 'bridge_template', label: 'Bridge template' },
    { name: 'workshop_template', label: 'Workshop template' },
  ].map(({ name, label }) => ({
    name,
    label,
    type: 'relationship',
    relationTo: 'forms',
    filterOptions: { template: { equals: true } },
  })),
}
