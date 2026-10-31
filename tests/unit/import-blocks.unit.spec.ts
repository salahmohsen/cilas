import { describe, expect, it } from 'vitest'

import { blocksToLexical, splitAttribution, type Block } from '../../migration/lib/blocks'

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

  it('turns [label](url) into a custom link node between text nodes', () => {
    const root = blocksToLexical(
      [{ type: 'paragraph', text: 'See [the form](https://example.org/f?a=1) now.' }],
      'ltr',
    )!.root
    const children = (root.children[0] as unknown as { children: Array<Record<string, unknown>> })
      .children
    expect(children.map((c) => c.type)).toEqual(['text', 'link', 'text'])
    expect(children[0]).toMatchObject({ text: 'See ' })
    expect(children[1]).toMatchObject({
      fields: { url: 'https://example.org/f?a=1', newTab: false, linkType: 'custom' },
      direction: 'ltr',
      children: [{ type: 'text', text: 'the form', format: 0 }],
    })
    expect(children[2]).toMatchObject({ text: ' now.' })
  })

  it('makes **bold** bold text, bold links keep the bold, and stray markers vanish', () => {
    const kids = (text: string) =>
      (
        blocksToLexical([{ type: 'paragraph', text }], 'ltr')!.root.children[0] as unknown as {
          children: Array<Record<string, unknown>>
        }
      ).children
    expect(kids('a **b** c').map((c) => [c.text, c.format])).toEqual([
      ['a ', 0],
      ['b', 1],
      [' c', 0],
    ])
    expect(kids('ten weeks** **with two')).toMatchObject([
      { text: 'ten weeks' },
      { text: ' ', format: 0 },
      { text: 'with two' },
    ])
    expect(kids('**[apply](https://x.org)**')).toMatchObject([
      { type: 'link', children: [{ text: 'apply', format: 1 }] },
    ])
    expect(
      kids('one ** unpaired')
        .map((c) => c.text)
        .join(''),
    ).toBe('one  unpaired')
  })
})

describe('splitAttribution', () => {
  it('takes the source after the closing quotation mark', () => {
    expect(splitAttribution('“Knowledge is a sphere.” – Blaise Pascal[^1]')).toEqual([
      '“Knowledge is a sphere.”',
      'Blaise Pascal[^1]',
    ])
  })
  it('takes a last line that starts with a tilde', () => {
    expect(splitAttribution('“بدلاً من هدر طاقتك”\n~ بول جودمان في سوء التعليم الإلزامي')).toEqual([
      '“بدلاً من هدر طاقتك”',
      'بول جودمان في سوء التعليم الإلزامي',
    ])
  })
  it('leaves a quote whose tail quotes a title', () => {
    const text = '“Teach me how to do it?” (Bowman, "Sifu," pp. 154-155)'
    expect(splitAttribution(text)).toEqual([text, null])
  })
})

describe('blocksToLexical quotes', () => {
  it('joins a source paragraph to the quote before it', () => {
    const root = blocksToLexical(
      [
        { type: 'quote', text: '“Said.”' },
        { type: 'paragraph', text: '~ Someone' },
      ],
      'ltr',
    )!.root
    expect(root.children).toHaveLength(1)
    const quote = root.children[0] as unknown as {
      type: string
      children: Array<{ type: string; text?: string }>
    }
    expect(quote.type).toBe('quote')
    expect(quote.children.map((c) => c.text ?? c.type)).toEqual([
      '“Said.”',
      'linebreak',
      '— Someone',
    ])
  })
})
