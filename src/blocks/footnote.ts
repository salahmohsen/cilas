import {
  BoldFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  ParagraphFeature,
} from '@payloadcms/richtext-lexical'
import type { Block } from 'payload'

/**
 * A footnote, written where it belongs in the text: in the editor, place the
 * cursor after the words it explains and insert a Footnote. The site numbers
 * footnotes in reading order, shows each in a hover card at its mark, and
 * lists them all at the end of the article.
 */
export const Footnote: Block = {
  slug: 'footnote',
  interfaceName: 'FootnoteBlock',
  labels: { singular: 'Footnote', plural: 'Footnotes' },
  fields: [
    {
      name: 'note',
      type: 'richText',
      required: true,
      // Notes cite and gloss: emphasis and links, nothing structural.
      editor: lexicalEditor({ features: [ParagraphFeature(), BoldFeature(), ItalicFeature(), LinkFeature()] }),
    },
    {
      name: 'url',
      type: 'text',
      label: 'Source link',
      admin: { description: 'Where the reference can be read online (optional). Shown as a link with the note.' },
      validate: (value: string | null | undefined) =>
        !value || /^https?:\/\/\S+$/.test(value) || 'A full web address, starting with http:// or https://',
    },
  ],
}
