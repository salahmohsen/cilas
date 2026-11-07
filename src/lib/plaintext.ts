import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import { flattenRichTextColumns } from '@/lib/flatten-rich-text-columns'

export const plainText = ({ data }: { data: SerializedEditorState | { root: unknown } }): string =>
  convertLexicalToPlaintext({
    data: flattenRichTextColumns(data as SerializedEditorState),
    converters: {
      inlineBlocks: {
        mention: ({ node }) => String((node.fields as { label?: string }).label ?? ''),
      },
    },
  })
