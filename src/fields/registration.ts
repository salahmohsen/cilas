import type { NamedGroupField, TextFieldSingleValidation } from 'payload'
import { text } from 'payload/shared'

import { REGISTRATION_METHODS } from '@/lib/registration'
import { httpUrl } from './validators'

const METHOD_LABELS: Record<(typeof REGISTRATION_METHODS)[number], string> = {
  form: 'Site form',
  external: 'External link',
  closed: 'Closed',
}

/**
 * How people apply. Whether it is open now comes from `registrationStatus()`,
 * never from a stored flag.
 */
export const registrationField = (): NamedGroupField => ({
  name: 'registration',
  type: 'group',
  fields: [
    {
      name: 'method',
      type: 'select',
      options: REGISTRATION_METHODS.map((value) => ({ label: METHOD_LABELS[value], value })),
      admin: { description: "Leave empty on a course to use its cycle's." },
    },
    {
      name: 'form',
      type: 'relationship',
      relationTo: 'forms',
      admin: { condition: (_, sibling) => sibling?.method === 'form' },
    },
    {
      name: 'url',
      type: 'text',
      validate: ((value, options) => {
        const base = text(value, options)
        if (base !== true) return base
        return value ? httpUrl(value) : true
      }) satisfies TextFieldSingleValidation,
      admin: {
        condition: (_, sibling) => sibling?.method === 'external',
        placeholder: 'https://…',
      },
    },
    {
      name: 'deadline',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description: "The last day to register, in Cairo. Empty on a course uses its cycle's.",
      },
    },
    // The old Weebly or Google Forms link, kept for the record.
    { name: 'archived_registration_url', type: 'text', admin: { hidden: true } },
  ],
})
