import {
  ValidationError,
  type CollectionBeforeValidateHook,
  type Condition,
  type PayloadRequest,
  type RelationshipField,
} from 'payload'

import { relId } from '@/lib/relation'
import type { Form, RegistrationDefault } from '@/payload-types'

/** What the Form field says, and the error when a site form has none. */
export type FormHelp = { description?: string; missing: string }

/** The help for a place whose empty form is filled from a template in Registration defaults. */
export const templateFormHelp = (template: string, when = ''): FormHelp => ({
  description: `${when}Leave empty to use a copy of the ${template} from Registration defaults. You can edit the copy freely; the template stays unchanged.`,
  missing: `Choose a form, or set a ${template} in Registration defaults.`,
})

export const registrationFormField = (
  condition: Condition,
  description: string | undefined,
): RelationshipField => ({
  name: 'form',
  type: 'relationship',
  relationTo: 'forms',
  filterOptions: { template: { not_equals: true } },
  admin: { description, condition },
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

type TemplateDefaults = Pick<
  RegistrationDefault,
  'cycle_template' | 'bridge_template' | 'workshop_template'
>

/** Tests pass the defaults here instead of writing the shared global. */
export const REGISTRATION_DEFAULTS = 'registrationDefaults'

type Entity = { kind?: string | null; registration?: { mode?: string | null } | null }

/**
 * Copies the template that Registration defaults names under `key`. Returns
 * null when no template is named there.
 */
export const copyDefaultTemplate = async (
  req: PayloadRequest,
  key: keyof TemplateDefaults,
  title: string,
): Promise<Form | null> => {
  const defaults: TemplateDefaults =
    (req.context[REGISTRATION_DEFAULTS] as TemplateDefaults | undefined) ??
    (await req.payload.findGlobal({ slug: 'registration-defaults', depth: 0, req }))
  const id = relId(defaults[key])
  if (!id) return null
  const template = await req.payload.findByID({ collection: 'forms', id, depth: 0, req })
  if (!template.template) {
    throw new ValidationError({
      errors: [
        { path: 'registration.form', message: 'Choose a template in Registration defaults.' },
      ],
    })
  }
  // Payload duplicates all locales, including nested question labels and email content.
  return req.payload.duplicate({
    collection: 'forms',
    id,
    req,
    depth: 0,
    data: { title, template: false },
  })
}

export const copyRegistrationTemplate =
  (
    key: keyof TemplateDefaults,
    applies: (entity: Entity) => boolean,
  ): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, req }) => {
    if (!data) return data
    const entity = { ...originalDoc, ...data }
    const registration = { ...originalDoc?.registration, ...data.registration }
    if (!applies({ ...entity, registration })) return data
    if (registration.method !== 'form' || relId(registration.form)) return data
    const copy = await copyDefaultTemplate(req, key, `${entity.title} application`)
    if (copy) data.registration = { ...registration, form: copy.id }
    return data
  }
