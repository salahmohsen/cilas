import { describe, expect, it } from 'vitest'

import { footnotesOf } from '@/lib/footnotes'

const note = (text: string) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
})
const fn = (id: string, text: string) => ({
  type: 'inlineBlock',
  fields: { id, blockType: 'footnote', note: note(text) },
})

describe('footnotesOf', () => {
  it('numbers footnotes in reading order, across paragraphs and nesting', () => {
    const body = {
      root: {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'One' }, fn('a', 'first')] },
          { type: 'quote', children: [{ type: 'text', text: 'Quoted' }, fn('b', 'second')] },
          { type: 'list', children: [{ type: 'listitem', children: [fn('c', 'third')] }] },
        ],
      },
    }
    expect(footnotesOf(body).map((f) => [f.id, f.number])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
  })

  it('ignores other inline blocks and empty bodies', () => {
    expect(
      footnotesOf({
        root: { children: [{ type: 'inlineBlock', fields: { id: 'x', blockType: 'mention' } }] },
      }),
    ).toEqual([])
    expect(footnotesOf(null)).toEqual([])
  })
})
