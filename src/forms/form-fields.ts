import { fields as builtIn } from '@payloadcms/plugin-form-builder'
import type { Block, Field } from 'payload'

import { DEFAULT_SIZE_MB, FILE_KINDS, MAX_FILES, MAX_SIZE_MB } from '@/lib/form-files'

/**
 * The form builder's fields as CILAS's forms use them. Questions carry a help
 * text under their label; essays can show an image and ask for a number of
 * words; and a checkbox group answers questions with several choices (how
 * did you hear of us, which track), which the plugin has no field for.
 */

type BuiltIn = (typeof builtIn)[keyof typeof builtIn]
/** The plugin gives some fields as blocks and some as functions that make one. */
const block = (b: BuiltIn): Block => (typeof b === 'function' ? b() : b)

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
    // The name and label row, as the other questions have it.
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
