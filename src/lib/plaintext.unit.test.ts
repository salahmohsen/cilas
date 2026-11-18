import { describe, expect, it } from 'vitest'

import { excerptOf, readingMinutes } from '@/lib/articles'
import { plainText } from '@/lib/plaintext'

const text = (t: string) => ({
  type: 'text',
  version: 1,
  text: t,
  format: 0,
  mode: 'normal',
  style: '',
  detail: 0,
})
const body = {
  root: {
    type: 'root',
    version: 1,
    children: [
      {
        type: 'paragraph',
        version: 1,
        children: [
          text('Taught by '),
          {
            type: 'inlineBlock',
            version: 1,
            fields: { id: 'm1', blockType: 'mention', label: 'Ghosoun Ismail', type: 'person' },
          },
          text(' in Cairo.'),
          {
            type: 'inlineBlock',
            version: 1,
            fields: { id: 'f1', blockType: 'footnote', note: null },
          },
        ],
      },
    ],
  },
}

describe('plainText', () => {
  it('keeps a mention’s words and leaves footnotes out', () => {
    expect(plainText({ data: body as never })).toBe('Taught by Ghosoun Ismail in Cairo.')
  })

  it('feeds excerpts, so meta descriptions keep the names', () => {
    expect(excerptOf({ body } as never)).toBe('Taught by Ghosoun Ismail in Cairo.')
    expect(readingMinutes({ body } as never)).toBe(1)
  })
})
