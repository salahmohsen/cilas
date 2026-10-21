import { describe, expect, it } from 'vitest'

import { bioBaseline, bioToSend } from '@/components/profile/bio'

// What the editor reports on mount for a stored bio is its own rendering of it.
const mounted = (original: string) => bioBaseline(original)

describe('bioToSend', () => {
  it('sends the original back when the editor only re-serialised it', () => {
    for (const original of ['First *it* here', 'a\nb', 'Plain text', '']) {
      expect(bioToSend(original, mounted(original), bioBaseline(original))).toBe(original)
    }
  })

  it('knows the editor rewrites emphasis and soft line breaks', () => {
    expect(mounted('First *it* here')).toBe('First _it_ here')
    expect(mounted('a\nb')).toBe('a b')
  })

  it('ignores trailing whitespace differences', () => {
    expect(bioToSend('x *y*', `${mounted('x *y*')}\n`, bioBaseline('x *y*'))).toBe('x *y*')
  })

  it('sends the edit when the member changed the text', () => {
    expect(bioToSend('x *y*', 'x _y_ z', bioBaseline('x *y*'))).toBe('x _y_ z')
  })
})
