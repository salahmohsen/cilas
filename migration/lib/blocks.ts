import type { LexicalChild, LexicalJSON } from '../../seed/seed.type'

export type Block = {
  type: 'heading' | 'paragraph' | 'quote' | 'list_item' | 'note'
  level?: number | null
  text: string
}

type Direction = 'ltr' | 'rtl'

const textNode = (text: string): LexicalChild => ({
  type: 'text',
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  text,
  version: 1,
})

/** Fields every Lexical element node carries (see ElementNode.exportJSON). */
const element = (
  type: string,
  direction: Direction,
  children: LexicalChild[],
  extra: object = {},
): LexicalChild => ({
  type,
  format: '',
  indent: 0,
  version: 1,
  direction,
  children,
  ...extra,
})

const paragraph = (text: string, direction: Direction) =>
  element('paragraph', direction, [textNode(text)], { textFormat: '', textStyle: '' })

const heading = (text: string, level: number, direction: Direction) =>
  element('heading', direction, [textNode(text)], { tag: `h${Math.min(4, Math.max(2, level))}` })

/**
 * Typed article blocks as a Lexical document: real headings, quotes and lists.
 * Notes go last under one "Notes" heading. No blocks → null.
 */
export const blocksToLexical = (blocks: Block[], direction: Direction): LexicalJSON | null => {
  if (blocks.length === 0) return null

  const children: LexicalChild[] = []
  const notes: Block[] = []
  let list: LexicalChild | null = null

  for (const block of blocks) {
    if (block.type !== 'list_item') list = null
    if (block.type === 'note') {
      notes.push(block)
    } else if (block.type === 'heading') {
      children.push(heading(block.text, block.level ?? 2, direction))
    } else if (block.type === 'quote') {
      children.push(element('quote', direction, [textNode(block.text)]))
    } else if (block.type === 'list_item') {
      if (!list) {
        list = element('list', direction, [], { listType: 'bullet', tag: 'ul', start: 1 })
        children.push(list)
      }
      const items = list.children as LexicalChild[]
      items.push(
        element('listitem', direction, [textNode(block.text)], { value: items.length + 1 }),
      )
    } else {
      children.push(paragraph(block.text, direction))
    }
  }

  if (notes.length) {
    children.push(heading(direction === 'rtl' ? 'ملاحظات' : 'Notes', 3, direction))
    for (const note of notes) children.push(paragraph(note.text, direction))
  }

  return { root: { type: 'root', format: '', indent: 0, version: 1, direction, children } }
}
