import {
  ValidationError,
  type CollectionBeforeValidateHook,
  type Condition,
  type RelationshipField,
} from 'payload'

import { relId } from '@/lib/relation'

export const registrationFormField = (
  condition: Condition = (_, sibling) => sibling?.method === 'form',
): RelationshipField => ({
  name: 'form',
  type: 'relationship',
  relationTo: 'forms',
  filterOptions: { template: { not_equals: true } },
  admin: {
    description:
      'A form copied from a template can be edited freely. Changes do not affect the template or other copies.',
    condition,
  },
  hooks: {
    beforeValidate: [
      async ({ value, req }) => {
        const id = relId(value)
        if (!id) return value
        const form = await req.payload.findByID({ collection: 'forms', id, depth: 0, req })
        if (form.template) {
          throw new ValidationError({
            errors: [
              {
                path: 'registration.form',
                message:
                  'A template cannot be used for registration. Choose a copy of the template instead.',
              },
            ],
          })
        }
        return value
      },
    ],
  },
})

export const copyRegistrationTemplate: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  collection,
  req,
}) => {
  if (!data) return data
  const entity = { ...originalDoc, ...data }
  const registration = { ...originalDoc?.registration, ...data.registration }
  if (registration.method !== 'form' || relId(registration.form)) return data
  const key =
    collection.slug === 'courses' &&
    registration.mode === 'own' &&
    (operation === 'create' ||
      originalDoc?.registration?.mode !== 'own' ||
      originalDoc?.registration?.method !== 'form')
      ? 'workshop_template'
      : operation === 'create' && collection.slug === 'cycles'
        ? 'cycle_template'
        : operation === 'create' && collection.slug === 'programmes' && entity.kind === 'bridge'
          ? 'bridge_template'
          : null
  if (!key) return data
  const defaults = await req.payload.findGlobal({ slug: 'registration-defaults', depth: 0, req })
  const id = relId(defaults[key])
  if (!id) return data
  const template = await req.payload.findByID({ collection: 'forms', id, depth: 0, req })
  if (!template.template) {
    throw new ValidationError({
      errors: [
        { path: 'registration.form', message: 'Choose a template in Registration defaults.' },
      ],
    })
  }
  // Payload duplicates all locales, including nested question labels and email content.
  const copy = await req.payload.duplicate({
    collection: 'forms',
    id,
    req,
    depth: 0,
    data: { title: `${entity.title} application`, template: false },
  })
  data.registration = { ...registration, form: copy.id }
  return data
}
