import { fields as builtIn } from '@payloadcms/plugin-form-builder'
import type { Block, Field } from 'payload'

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
  message: true,
} as const
