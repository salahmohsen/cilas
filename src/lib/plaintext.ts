import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'

/**
 * Rich text as plain text, for excerpts, meta descriptions, reading time and
 * search. A mention keeps its words (they are part of the sentence); a
 * footnote is left out, as before.
 */
export const plainText = ({ data }: { data: SerializedEditorState | { root: unknown } }): string =>
  convertLexicalToPlaintext({
    data: data as SerializedEditorState,
    converters: {
      inlineBlocks: {
        mention: ({ node }) => String((node.fields as { label?: string }).label ?? ''),
      },
    },
  })
