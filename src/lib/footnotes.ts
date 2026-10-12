import type { FootnoteBlock } from '@/payload-types'

type Node = { type?: string; fields?: unknown; children?: Node[] }

export type Footnote = { id: string; number: number; note: FootnoteBlock['note']; url?: string | null }

/**
 * The footnotes of a rich text, in reading order, numbered from 1. They are
 * inline blocks (blockType `footnote`) anywhere in the tree.
 */
export const footnotesOf = (data: { root?: Node } | null | undefined): Footnote[] => {
  const found: Footnote[] = []
  const walk = (node: Node) => {
    const fields = node.fields as (Partial<FootnoteBlock> & { id?: string }) | undefined
    if (node.type === 'inlineBlock' && fields?.blockType === 'footnote' && fields.id) {
      found.push({ id: fields.id, number: found.length + 1, note: fields.note as FootnoteBlock['note'], url: fields.url ?? null })
    }
    node.children?.forEach(walk)
  }
  if (data?.root) walk(data.root)
  return found
}
