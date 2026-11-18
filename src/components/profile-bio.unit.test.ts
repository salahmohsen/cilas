import { describe, expect, it } from 'vitest'

import { markdownBaseline, markdownToSend } from '@/components/markdown-edit'

// What the editor reports on mount for a stored bio is its own rendering of it.
const mounted = (original: string) => markdownBaseline(original)

describe('markdownToSend', () => {
  it('sends the original back when the editor only re-serialised it', () => {
    for (const original of ['First *it* here', 'a\nb', 'Plain text', '']) {
      expect(markdownToSend(original, mounted(original), markdownBaseline(original))).toBe(original)
    }
  })

  it('knows the editor rewrites emphasis and soft line breaks', () => {
    expect(mounted('First *it* here')).toBe('First _it_ here')
    expect(mounted('a\nb')).toBe('a b')
  })

  it('ignores trailing whitespace differences', () => {
    expect(markdownToSend('x *y*', `${mounted('x *y*')}\n`, markdownBaseline('x *y*'))).toBe(
      'x *y*',
    )
  })

  it('sends the edit when the member changed the text', () => {
    expect(markdownToSend('x *y*', 'x _y_ z', markdownBaseline('x *y*'))).toBe('x _y_ z')
  })
})
