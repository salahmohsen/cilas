import {
  BoldFeature,
  BlocksFeature,
  FixedToolbarFeature,
  InlineToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  LinkFeature,
  ParagraphFeature,
} from '@payloadcms/richtext-lexical'
import type { Block } from 'payload'
import { Mention } from './mention'

/**
 * A footnote, written where it belongs in the text: in the editor, place the
 * cursor after the words it explains and insert a Footnote. The site numbers
 * footnotes in reading order, shows each in a hover card at its mark, and
 * lists them all at the end of the article. Links go in the note's own text.
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
      // Notes cite and gloss: emphasis and links, nothing structural. The
      // toolbars carry the link button (select words, then link them); a URL
      // typed or pasted into the note becomes a link by itself.
      editor: lexicalEditor({
        features: [
          ParagraphFeature(),
          BoldFeature(),
          ItalicFeature(),
          LinkFeature(),
          FixedToolbarFeature(),
          InlineToolbarFeature(),
          BlocksFeature({ inlineBlocks: [Mention] }),
        ],
      }),
    },
  ],
}
