import { validations, type GlobalConfig, type RelationshipFieldSingleValidation } from 'payload'

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
    // This admin-only global also supports trusted local seeds without a logged-in user.
    validate: ((value, args) =>
      validations.relationship(value, {
        ...args,
        overrideAccess: true,
      })) as RelationshipFieldSingleValidation,
  })),
}
