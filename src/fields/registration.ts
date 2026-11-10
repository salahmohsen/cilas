import { registrationFormField } from '@/forms/templates'
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

export const validateDestination: FieldHook = async ({
  value,
  originalDoc,
  data,
  operation,
  collection,
  req,
}) => {
  const publishing = data?._status === 'published' || data?.review?.status === 'approved'
  if (data?._status === 'draft' && !publishing && data?.review?.status !== 'submitted') return value
  const own = { ...originalDoc?.registration, ...value }
  if (
    collection?.slug === 'courses' &&
    own.mode === 'own' &&
    !['form', 'external'].includes(own.method)
  ) {
    throw new ValidationError({
      errors: [{ path: 'registration.method', message: 'Choose a registration method.' }],
    })
  }
  const previous = originalDoc?.registration
  const changed = ['mode', 'method', 'form', 'url'].some((key) => own[key] !== previous?.[key])
  if (operation === 'update' && !changed && data?.cycle === originalDoc?.cycle && !publishing)
    return value
  let parent
  const cycle = data?.cycle === undefined ? originalDoc?.cycle : data.cycle
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
  const resolved =
    collection?.slug === 'courses'
      ? courseRegistration({ registration: own }, parent)
      : { method: own.method, formId: relId(own.form), url: own.url }
  const method = resolved.method
  if (
    collection?.slug === 'courses' &&
    (own.mode ?? 'follow_cycle') === 'follow_cycle' &&
    publishing &&
    !method
  ) {
    throw new ValidationError({
      errors: [
        {
          path: 'registration.mode',
          message: 'Set up registration on the cycle before publishing.',
        },
      ],
    })
  }
  const field = method === 'form' ? 'form' : method === 'external' ? 'url' : null
  const destination = field === 'form' ? resolved.formId : field === 'url' ? resolved.url : null
  if (field && (!destination || (field === 'url' && httpUrl(destination) !== true))) {
    throw new ValidationError({
      errors: [
        {
          path: `registration.${field}`,
          message:
            field === 'form'
              ? 'Choose a registration form on the course or its cycle.'
              : 'Enter the external registration URL on the course or its cycle.',
        },
      ],
    })
  }
  return value
}

export const registrationField = (): NamedGroupField => ({
  name: 'registration',
  type: 'group',
  hooks: { beforeChange: [validateDestination] },
  fields: [
    {
      name: 'method',
      type: 'select',
      options: REGISTRATION_METHODS.map((value) => ({ label: METHOD_LABELS[value], value })),
    },
    registrationFormField(),
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
        description: 'The last day to register, in Cairo.',
      },
    },
    { name: 'archived_registration_url', type: 'text', admin: { hidden: true } },
  ],
})
