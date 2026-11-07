import type { SerializedBlockNode } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import type { ColumnsBlock } from '@/payload-types'

export const flattenRichTextColumns = (data: SerializedEditorState): SerializedEditorState => ({
  ...data,
  root: {
    ...data.root,
    children: data.root.children.flatMap((node) => {
      if (node.type !== 'block') return [node]
      const { fields } = node as SerializedBlockNode<ColumnsBlock>
      if (fields.blockType !== 'columns') return [node]
      return [fields.first, fields.second, fields.third, fields.fourth]
        .slice(0, Number(fields.columnCount ?? 2))
        .flatMap((column) => column?.root?.children ?? [])
    }),
  },
})
