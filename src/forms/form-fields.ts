import { fields as builtIn } from '@payloadcms/plugin-form-builder'
import type {
  Block,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  Field,
  FieldHook,
  TextField,
} from 'payload'
import { ValidationError } from 'payload'

import { DEFAULT_SIZE_MB, FILE_KINDS, MAX_FILES, MAX_SIZE_MB } from '@/lib/form-files'
import type { Form } from '@/payload-types'

import { nameQuestions, QUESTION_NAME, QUESTION_NAME_RULE } from './question-name'

/**
 * The form builder's fields as CILAS's forms use them. Questions carry a help
 * text under their label; essays can show an image and ask for a number of
 * words; and a checkbox group answers questions with several choices (how
 * did you hear of us, which track), which the plugin has no field for.
 */

type BuiltIn = (typeof builtIn)[keyof typeof builtIn]

/** Made once by nameQuestions from the label; an admin never sees or types it. */
const questionName: TextField = {
  name: 'name',
  type: 'text',
  required: true,
  admin: { hidden: true },
  // The value the assistant gives may be left out: nameQuestions makes it.
  custom: { generated: true },
}

/**
 * Names new questions and refuses a given name that breaks the rule. This
 * runs for drafts too, which skip field validation.
 */
const named = <B extends Parameters<typeof nameQuestions>[0][number]>(
  path: string,
  ...args: Parameters<typeof nameQuestions<B>>
): B[] => {
  const blocks = nameQuestions(...args)
  const errors = blocks.flatMap((b, i) => [
    ...(b.name && !QUESTION_NAME.test(b.name)
      ? [{ path: `${path}.${i}.name`, message: QUESTION_NAME_RULE }]
      : []),
    ...(b.options ?? []).flatMap((o, j) =>
      o.value && !QUESTION_NAME.test(o.value)
        ? [{ path: `${path}.${i}.options.${j}.value`, message: QUESTION_NAME_RULE }]
        : [],
    ),
  ])
  if (errors.length) throw new ValidationError({ errors })
  return blocks
}

/** Made once by nameQuestions from the option's label; an admin sees only the label. */
const optionValue: TextField = {
  name: 'value',
  type: 'text',
  required: true,
  admin: { hidden: true },
  custom: { generated: true },
}

const withMachineNames = (fields: Field[], inOptions = false): Field[] =>
  fields.map((f) => {
    if ('name' in f && f.name === 'name' && !inOptions) return questionName
    if ('name' in f && f.name === 'value' && inOptions) return optionValue
    if (f.type === 'row') return { ...f, fields: withMachineNames(f.fields, inOptions) }
    if (f.type === 'array' && f.name === 'options')
      return { ...f, fields: withMachineNames(f.fields, true) }
    return f
  })

/** The plugin gives some fields as blocks and some as functions that make one. */
const block = (b: BuiltIn): Block => {
  const base = typeof b === 'function' ? b() : b
  return { ...base, fields: withMachineNames(base.fields) }
}

const description: Field = {
  name: 'description',
  type: 'textarea',
  localized: true,
  admin: { description: 'Help text under the question.' },
}

const withDescription = (b: BuiltIn, extra: Field[] = []): Block => {
  const base = block(b)
  return { ...base, fields: [...base.fields, description, ...extra] }
}

const radio = block(builtIn.radio)
export const checkboxGroup: Block = {
  ...radio,
  slug: 'checkboxGroup',
  labels: { singular: 'Checkbox group', plural: 'Checkbox groups' },
  fields: [...radio.fields, description],
}

const text = block(builtIn.text)

/**
 * A question answered with files: a CV, a writing sample, a portfolio. The
 * files are kept privately for admins (src/collections/SubmissionFiles.ts);
 * the answer is their download links.
 */
export const fileUpload: Block = {
  slug: 'fileUpload',
  labels: { singular: 'File upload', plural: 'File uploads' },
  fields: [
    text.fields[0]!,
    description,
    {
      name: 'accept',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['pdf'],
      options: Object.entries(FILE_KINDS).map(([value, { label }]) => ({ value, label })),
      admin: { description: 'The kinds of file allowed.' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'maxSizeMB',
          label: 'Largest file (MB)',
          type: 'number',
          min: 1,
          max: MAX_SIZE_MB,
          defaultValue: DEFAULT_SIZE_MB,
          admin: { width: '50%' },
        },
        {
          name: 'multiple',
          label: `Several files (up to ${MAX_FILES})`,
          type: 'checkbox',
          admin: { width: '50%' },
        },
      ],
    },
    { name: 'required', type: 'checkbox' },
  ],
}

/**
 * The questions a course may add to its application (Courses →
 * applicant_questions): the answer fields, without email (the form asks it)
 * or text blocks.
 */
export const courseQuestionBlocks = (): Block[] => [
  formFields.text,
  formFields.textarea,
  formFields.radio,
  formFields.checkboxGroup,
  formFields.checkbox,
  formFields.select,
  formFields.number,
  fileUpload,
]

export const formFields = {
  text: withDescription(builtIn.text),
  textarea: withDescription(builtIn.textarea, [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'An image the question asks about, shown above the answer.' },
    },
    {
      name: 'minWords',
      type: 'number',
      min: 1,
      admin: { description: 'The fewest words an answer may have.' },
    },
  ]),
  email: withDescription(builtIn.email),
  radio: withDescription(builtIn.radio),
  checkboxGroup,
  checkbox: withDescription(builtIn.checkbox),
  select: withDescription(builtIn.select),
  number: withDescription(builtIn.number),
  fileUpload,
  message: true,
} as const

/**
 * The two answers every form asks first (ensureNameEmail): who the person is,
 * and the address an acceptance mails. Acceptance (src/forms/application-decision.ts)
 * reads exactly these field names, so no form can exist without them and no
 * admin can delete or rename them.
 */
export type NameEmailBlock = {
  blockType: 'text' | 'email'
  name: string
  label: string
  required: true
}

export const nameEmailBlocks: NameEmailBlock[] = [
  { blockType: 'text', name: 'name', label: 'Name', required: true },
  { blockType: 'email', name: 'email', label: 'Email', required: true },
]

/**
 * Putting the two questions back stands for an admin's delete or rename: the
 * saved form always carries name and email, in that order, before anything.
 */
export const ensureNameEmail: CollectionBeforeChangeHook<Form> = ({ data }) => ({
  ...data,
  fields: [
    ...(nameEmailBlocks as unknown as NonNullable<Form['fields']>),
    ...(data.fields ?? []).filter((b) =>
      'name' in b ? b.name !== 'name' && b.name !== 'email' : true,
    ),
  ],
})

/** Names a form's new questions. `name` and `email` stay the default questions'. */
export const nameNewFormQuestions: CollectionBeforeValidateHook<Form> = ({ data, originalDoc }) =>
  data?.fields
    ? {
        ...data,
        fields: named('fields', data.fields, {
          saved: originalDoc?.fields ?? [],
          reserved: nameEmailBlocks.map((b) => b.name),
        }),
      }
    : data

/** Names a course's new applicant questions. */
export const nameNewQuestions: FieldHook = ({ value, originalDoc }) =>
  Array.isArray(value)
    ? named('applicant_questions', value, { saved: originalDoc?.applicant_questions ?? [] })
    : value
