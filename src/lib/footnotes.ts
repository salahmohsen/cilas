import type { FootnoteBlock } from '@/payload-types'
import { walkEditorNodes } from '@/lib/rich-text-references'

type Node = { type?: string; fields?: unknown; children?: Node[] }

export type Footnote = { id: string; number: number; note: FootnoteBlock['note'] }

export const footnotesOf = (data: { root?: Node } | null | undefined): Footnote[] => {
  const found: Footnote[] = []
  const walk = (node: Node) => {
    const fields = node.fields as (Partial<FootnoteBlock> & { id?: string }) | undefined
    if (node.type === 'inlineBlock' && fields?.blockType === 'footnote' && fields.id) {
      found.push({
        id: fields.id,
        number: found.length + 1,
        note: fields.note as FootnoteBlock['note'],
      })
    }
  }
  walkEditorNodes(data, walk)
  return found
}
