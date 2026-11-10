import { relId } from '@/lib/relation'
import {
  ValidationError,
  type FieldHook,
  type NamedGroupField,
  type TextFieldSingleValidation,
} from 'payload'
import { text } from 'payload/shared'

import { courseRegistration, REGISTRATION_METHODS } from '@/lib/registration'
import { httpUrl, optionalHttpUrl } from './validators'

const METHOD_LABELS: Record<(typeof REGISTRATION_METHODS)[number], string> = {
  form: 'Site form',
  external: 'External link',
  closed: 'Closed',
}

const validateDestination: FieldHook = async ({
  value,
  originalDoc,
  data,
  operation,
  collection,
  req,
}) => {
  if (data?._status === 'draft' && data?.review?.status !== 'submitted') return value
  const own = { ...originalDoc?.registration, ...value }
  const previous = originalDoc?.registration
  const publishing = data?._status === 'published' || data?.review?.status === 'approved'
  const changed = ['method', 'form', 'url'].some((key) => own[key] !== previous?.[key])
  if (operation === 'update' && !changed && data?.cycle === originalDoc?.cycle && !publishing)
    return value
  let parent
  const cycle = data?.cycle ?? originalDoc?.cycle
  const cycleId = relId(cycle)
  if (collection?.slug === 'courses' && cycleId) {
    parent = await req.payload.findByID({
      collection: 'cycles',
      id: cycleId,
      depth: 0,
      req,
      overrideAccess: false,
    })
  }
  const resolved = courseRegistration({ registration: own }, parent)
  const method = resolved.method
  const field = method === 'form' ? 'form' : method === 'external' ? 'url' : null
  const destination = field === 'form' ? resolved.formId : field === 'url' ? resolved.url : null
  if (field && (!destination || (field === 'url' && httpUrl(destination) !== true))) {
    throw new ValidationError({
      errors: [
        {
          path: `registration.${field}`,
          message:
            field === 'form'
              ? 'Choose a registration form, or inherit one from the cycle.'
              : 'Enter the external registration URL, or inherit one from the cycle.',
        },
      ],
    })
  }
  return value
}

/**
 * How people apply. Whether it is open now comes from `registrationStatus()`,
 * never from a stored flag.
 */
export const registrationField = (): NamedGroupField => ({
  name: 'registration',
  type: 'group',
  hooks: { beforeChange: [validateDestination] },
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
        return optionalHttpUrl(value)
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
