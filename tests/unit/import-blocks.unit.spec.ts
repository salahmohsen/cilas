import { describe, expect, it } from 'vitest'

import { blocksToLexical, type Block } from '../../migration/lib/blocks'

const blocks: Block[] = [
  { type: 'heading', level: 2, text: 'Introduction' },
  { type: 'paragraph', text: 'First.' },
  { type: 'quote', text: 'Said.' },
  { type: 'list_item', text: 'One' },
  { type: 'list_item', text: 'Two' },
  { type: 'note', text: '1. A source.' },
]

describe('blocksToLexical', () => {
  it('builds headings, quotes, one list and a trailing Notes section', () => {
    const root = blocksToLexical(blocks, 'ltr')!.root
    expect(root.children.map((c) => c.type)).toEqual([
      'heading',
      'paragraph',
      'quote',
      'list',
      'heading',
      'paragraph',
    ])
    expect(root.children[0]).toMatchObject({ tag: 'h2', direction: 'ltr', version: 1 })
    const list = root.children[3] as unknown as {
      listType: string
      tag: string
      start: number
      children: Array<{ type: string; value: number }>
    }
    expect(list).toMatchObject({ listType: 'bullet', tag: 'ul', start: 1 })
    expect(list.children.map((c) => [c.type, c.value])).toEqual([
      ['listitem', 1],
      ['listitem', 2],
    ])
    expect(root.children[4]).toMatchObject({ tag: 'h3', children: [{ text: 'Notes' }] })
    expect(root.children[5]).toMatchObject({ children: [{ text: '1. A source.' }] })
  })

  it('carries the direction, and titles Notes in Arabic for rtl', () => {
    const root = blocksToLexical(blocks, 'rtl')!.root
    expect(root.direction).toBe('rtl')
    expect(root.children.every((c) => c.direction === 'rtl')).toBe(true)
    expect(root.children[4]).toMatchObject({ children: [{ text: 'ملاحظات' }] })
  })

  it('starts a new list after an interruption, and returns null for no blocks', () => {
    const root = blocksToLexical(
      [
        { type: 'list_item', text: 'a' },
        { type: 'paragraph', text: 'p' },
        { type: 'list_item', text: 'b' },
      ],
      'ltr',
    )!.root
    expect(root.children.map((c) => c.type)).toEqual(['list', 'paragraph', 'list'])
    expect(blocksToLexical([], 'rtl')).toBeNull()
  })
})
