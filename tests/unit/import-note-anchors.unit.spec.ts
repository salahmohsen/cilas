import { describe, expect, it } from 'vitest'

import { blocksToLexical, type Block } from '../../migration/lib/blocks'
import { markNotes, offsetAfter } from '../../migration/lib/note-anchors'

describe('offsetAfter', () => {
  it('is the position just after words that occur once', () => {
    expect(offsetAfter('one two three', 'one two')).toBe(7)
  })
  it('refuses words that are missing or repeated', () => {
    expect(offsetAfter('one two one two', 'one two')).toBeNull()
    expect(offsetAfter('one two', 'three')).toBeNull()
  })
})

describe('markNotes', () => {
  it('puts each marker at its offset, several in one block', () => {
    const blocks = [{ type: 'paragraph', text: 'First claim. Second claim.' }]
    const marked = markNotes(blocks, [
      { number: 1, block: 0, offset: 12 },
      { number: 2, block: 0, offset: 26 },
    ])
    expect(marked[0].text).toBe('First claim.[^1] Second claim.[^2]')
  })
})

describe('blocksToLexical footnotes', () => {
  const blocks: Block[] = [
    { type: 'paragraph', level: null, text: 'A claim.[^7] More.' },
    { type: 'note', level: null, text: '7 A source, p. 3.' },
    { type: 'note', level: null, text: '8 Not marked anywhere.' },
  ]
  const doc = blocksToLexical(blocks, 'ltr')
  const children = doc?.root.children ?? []

  it('turns a marker into a footnote holding the note without its number', () => {
    const para = children[0] as unknown as { children: Array<{ type: string; fields?: { blockType: string; note: unknown } }> }
    const fn = para.children.find((c) => c.type === 'inlineBlock')
    expect(fn?.fields?.blockType).toBe('footnote')
    expect(JSON.stringify(fn?.fields?.note)).toContain('A source, p. 3.')
    expect(JSON.stringify(fn?.fields?.note)).not.toContain('"7 A source')
    expect(JSON.stringify(para)).not.toContain('[^7]')
  })

  it('keeps only unmarked notes in the closing list', () => {
    const text = JSON.stringify(children.slice(1))
    expect(text).toContain('Not marked anywhere.')
    expect(text).not.toContain('A source, p. 3.')
  })
})
