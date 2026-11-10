import { registrationFormField, type FormHelp } from '@/forms/templates'
import { relId } from '@/lib/relation'
import {
  ValidationError,
  type FieldHook,
  type Field,
  type SelectFieldSingleValidation,
  type NamedGroupField,
  type TextFieldSingleValidation,
} from 'payload'
import { text } from 'payload/shared'

import { courseRegistration, REGISTRATION_METHODS } from '@/lib/registration'
import {
  courseRegistrationMode,
  isPublishing,
  validateCourseMethod,
} from '@/lib/course-registration'
import { httpUrl, optionalHttpUrl } from './validators'

const METHOD_LABELS: Record<(typeof REGISTRATION_METHODS)[number], string> = {
  form: 'Site form',
  external: 'External link',
  closed: 'Closed',
}

const publishingOrSubmitted = (data: Parameters<FieldHook>[0]['data']) =>
  data?._status !== 'draft' || isPublishing(data) || data?.review?.status === 'submitted'

const checkDestination = (
  method: string | null | undefined,
  form: unknown,
  url: string | null | undefined,
  missingForm: string,
) => {
  const field = method === 'form' ? 'form' : method === 'external' ? 'url' : null
  const destination = field === 'form' ? form : url
  if (field && (!destination || (field === 'url' && httpUrl(destination) !== true))) {
    throw new ValidationError({
      errors: [
        {
          path: `registration.${field}`,
          message: field === 'form' ? missingForm : 'Enter the external registration URL.',
        },
      ],
    })
  }
}

const validateDestination =
  (missingForm: string): FieldHook =>
  async ({ value, originalDoc, data, operation }) => {
    if (!publishingOrSubmitted(data)) return value
    const own = { ...originalDoc?.registration, ...value }
    if (
      operation === 'update' &&
      ['method', 'form', 'url'].every((key) => own[key] === originalDoc?.registration?.[key]) &&
      !isPublishing(data)
    )
      return value
    checkDestination(own.method, relId(own.form), own.url, missingForm)
    return value
  }

export const validateCourseDestination =
  (help: FormHelp): FieldHook =>
  async ({ value, originalDoc, data, operation, req }) => {
    if (!publishingOrSubmitted(data)) return value
    const own = { ...originalDoc?.registration, ...value }
    const method = validateCourseMethod(own)
    if (method !== true)
      throw new ValidationError({ errors: [{ path: 'registration.method', message: method }] })
    const changed = ['mode', 'method', 'form', 'url'].some(
      (key) => own[key] !== originalDoc?.registration?.[key],
    )
    if (
      operation === 'update' &&
      !changed &&
      data?.cycle === originalDoc?.cycle &&
      !isPublishing(data)
    )
      return value
    const cycleId = relId(data?.cycle === undefined ? originalDoc?.cycle : data.cycle)
    const cycle = cycleId
      ? await req.payload.findByID({
          collection: 'cycles',
          id: cycleId,
          depth: 0,
          req,
          overrideAccess: false,
        })
      : null
    const resolved = courseRegistration({ registration: own }, cycle)
    if (courseRegistrationMode(own) === 'follow_cycle' && isPublishing(data) && !resolved.method) {
      throw new ValidationError({
        errors: [
          {
            path: 'registration.mode',
            message: 'Set up registration on the cycle before publishing.',
          },
        ],
      })
    }
    checkDestination(
      resolved.method,
      resolved.formId,
      resolved.url,
      courseRegistrationMode(own) === 'own'
        ? help.missing
        : 'Choose a registration form on the cycle.',
    )
    return value
  }

export const registrationDestinationFields = (help: FormHelp, course = false): Field[] => [
  {
    name: 'method',
    type: 'select',
    options: REGISTRATION_METHODS.filter((value) => !course || value !== 'closed').map((value) => ({
      label: METHOD_LABELS[value],
      value,
    })),
    ...(course
      ? {
          admin: { condition: (_, sibling) => courseRegistrationMode(sibling) === 'own' },
          validate: ((value, { siblingData }) =>
            validateCourseMethod({
              ...siblingData,
              method: value,
            })) satisfies SelectFieldSingleValidation,
        }
      : {}),
  },
  registrationFormField(
    (_, sibling) =>
      sibling?.method === 'form' && (!course || courseRegistrationMode(sibling) === 'own'),
    help.description,
  ),
  {
    name: 'url',
    type: 'text',
    validate: ((value, options) => {
      if (
        course &&
        (courseRegistrationMode(options.siblingData) !== 'own' ||
          (options.siblingData as { method?: string })?.method !== 'external')
      )
        return true
      const base = text(value, options)
      return base === true ? optionalHttpUrl(value) : base
    }) satisfies TextFieldSingleValidation,
    admin: {
      condition: (_, sibling) =>
        sibling?.method === 'external' && (!course || courseRegistrationMode(sibling) === 'own'),
      placeholder: 'https://…',
    },
  },
  {
    name: 'deadline',
    type: 'date',
    admin: {
      ...(course ? { condition: (_, sibling) => courseRegistrationMode(sibling) === 'own' } : {}),
      date: { pickerAppearance: 'dayOnly' },
      description: 'The last day to register, in Cairo.',
    },
  },
]

export const registrationField = (help: FormHelp): NamedGroupField => ({
  name: 'registration',
  type: 'group',
  hooks: { beforeChange: [validateDestination(help.missing)] },
  fields: [
    ...registrationDestinationFields(help),
    { name: 'archived_registration_url', type: 'text', admin: { hidden: true } },
  ],
})
