import { z } from 'zod/v3'

import { formFields } from '@/forms/form-fields'

import { localizedText, optionalLocalizedText } from './schemas'

/**
 * The question types the AI may add. Name and email are always asked first
 * (ensureNameEmail), and file uploads, messages and the rest are left to an
 * admin. Each type is checked against the form builder's own block list.
 */
export const TEXT_QUESTION_TYPES = ['text', 'textarea', 'number', 'checkbox'] as const
export const CHOICE_QUESTION_TYPES = ['select', 'radio', 'checkboxGroup'] as const
export const QUESTION_TYPES = [...TEXT_QUESTION_TYPES, ...CHOICE_QUESTION_TYPES] as const

export const questionTypesAreKnown = (): boolean =>
  QUESTION_TYPES.every((type) => type in formFields)

/** `name` and `email` are the form's own; the hook would drop a second one. */
export const RESERVED_QUESTION_NAMES = ['name', 'email']

const questionName = z
  .string()
  .regex(
    /^[a-z][a-z0-9_]{0,39}$/,
    'Use lower-case letters, digits and underscores, starting with a letter (e.g. motivation).',
  )
  .refine(
    (name) => !RESERVED_QUESTION_NAMES.includes(name),
    'name and email are asked by every form already.',
  )
  .describe('A short machine name, e.g. motivation. Unique in the form.')

const common = {
  name: questionName,
  label: localizedText('The question', 200),
  description: optionalLocalizedText('Help text under the question', 400),
  required: z.boolean().default(false).describe('Whether an answer is required.'),
}

export const questionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.enum(TEXT_QUESTION_TYPES).describe('The kind of answer.'), ...common }),
  z.object({
    type: z
      .enum(CHOICE_QUESTION_TYPES)
      .describe('select: a menu. radio: one choice. checkboxGroup: several.'),
    ...common,
    options: z
      .array(localizedText('A choice', 120))
      .min(2)
      .max(30)
      .describe('The choices, in order. The English text is the stored value.'),
  }),
])

export type Question = z.infer<typeof questionSchema>
