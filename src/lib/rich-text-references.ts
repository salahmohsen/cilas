import type { ResolvedMention } from '@/lib/mentions'
import { relId } from '@/lib/relation'

export type RichTextReferences = Record<string, ResolvedMention>

export const referenceKey = (collection: string, value: unknown): string => {
  const id = relId(value)
  return typeof id === 'number' || typeof id === 'string' ? `${collection}:${id}` : ''
}

export type EditorNode = {
  type?: string
  children?: EditorNode[]
  fields?: Record<string, unknown>
  relationTo?: string
  value?: unknown
}

export const walkEditorNodes = (
  data: unknown,
  visit: (node: EditorNode) => void,
  embedded = true,
): void => {
  if (!data || typeof data !== 'object') return
  if ('root' in data) return walkEditorNodes(data.root, visit, embedded)
  const node = data as EditorNode
  visit(node)
  for (const child of node.children ?? []) walkEditorNodes(child, visit, embedded)
  if (embedded && node.fields?.blockType === 'columns') {
    for (const key of ['first', 'second', 'third', 'fourth'].slice(
      0,
      Number(node.fields.columnCount ?? 2),
    )) {
      walkEditorNodes(node.fields[key], visit)
    }
  }
  if (embedded && node.fields?.blockType === 'footnote') walkEditorNodes(node.fields.note, visit)
}

export const documentsIn = (data: unknown): unknown[] => {
  const found: unknown[] = []
  const seen = new WeakSet<object>()
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if ('root' in value) {
      found.push(value)
      return
    }
    for (const child of Object.values(value)) walk(child)
  }
  walk(data)
  return found
}
