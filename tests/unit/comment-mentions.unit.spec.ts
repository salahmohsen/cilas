// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { commentPieces, fromMentionValue, toMentionValue } from '@/lib/comment-mentions'
import { validateMentions } from '@/lib/spaces-write'

describe('comment mentions', () => {
  const stored = 'Thanks [@Mona Ali](/people/7), see [@سارة](/people/12) too'

  it('splits a stored body into text and mentions', () => {
    expect(commentPieces(stored)).toEqual([
      { text: 'Thanks ' },
      { person: 7, name: 'Mona Ali' },
      { text: ', see ' },
      { person: 12, name: 'سارة' },
      { text: ' too' },
    ])
    expect(commentPieces('no mentions')).toEqual([{ text: 'no mentions' }])
  })

  it('round-trips through the mention input value', () => {
    const value = toMentionValue(stored)
    expect(value.text).toBe('Thanks @Mona Ali, see @سارة too')
    expect(value.text.slice(value.mentions[0].start, value.mentions[0].end)).toBe('@Mona Ali')
    expect(fromMentionValue(value)).toBe(stored)
  })

  it('writes what the write layer validates', () => {
    const body = fromMentionValue({
      text: 'hi @A [x]',
      mentions: [{ kind: 'person', id: '7', label: 'A [x]', start: 3, end: 9 }],
    })
    expect(body).toBe('hi [@A x](/people/7)')
    expect(validateMentions(body, new Set([7]))).toEqual({ mentioned: [7], invalid: [] })
  })
})
