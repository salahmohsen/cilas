import type {
  SerializedEditorState,
  SerializedLexicalNode,
} from '@payloadcms/richtext-lexical/lexical'
import type { ColumnsBlock } from '@/payload-types'

const COLUMN_NAMES = ['first', 'second', 'third', 'fourth'] as const
type EventNode = SerializedLexicalNode & {
  tag?: string
  children?: SerializedLexicalNode[]
  fields?: unknown
}

/** Normalize the event's section outline and editor spacers without changing saved content. */
export function eventDescription(data: SerializedEditorState): SerializedEditorState {
  const children = data.root.children as EventNode[]
  const levels = children.flatMap((node) =>
    node.type === 'heading' && typeof node.tag === 'string' && /^h[1-6]$/.test(node.tag)
      ? [Number(node.tag.slice(1))]
      : [],
  )
  const shift = Math.max(0, Math.min(...levels) - 2)
  return {
    ...data,
    root: {
      ...data.root,
      children: children
        .filter(
          (node) =>
            node.type !== 'paragraph' || !Array.isArray(node.children) || node.children.length > 0,
        )
        .map((node) => {
          if (node.type === 'heading' && typeof node.tag === 'string' && /^h[1-6]$/.test(node.tag))
            return { ...node, tag: `h${Math.max(2, Number(node.tag.slice(1)) - shift)}` }
          if (
            node.type !== 'block' ||
            typeof node.fields !== 'object' ||
            !node.fields ||
            !('blockType' in node.fields) ||
            node.fields.blockType !== 'columns'
          )
            return node
          const fields = node.fields as ColumnsBlock
          return {
            ...node,
            fields: {
              ...fields,
              ...Object.fromEntries(
                COLUMN_NAMES.flatMap((key) =>
                  fields[key] ? [[key, eventDescription(fields[key])]] : [],
                ),
              ),
            },
          }
        }),
    },
  }
}
