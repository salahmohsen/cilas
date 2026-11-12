import { describe, expect, it } from 'vitest'

import { decodeEntities, escapeHtml } from '@/lib/html-entities'
import { escapeRegExp } from '@/lib/regexp'

describe('html entities', () => {
  it('escapes the five characters that matter in HTML text and quoted attributes', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#x27;s&lt;/a&gt;',
    )
  })

  it('decodes once, so an escaped entity stays an entity', () => {
    expect(decodeEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;')
    expect(decodeEntities('Tom &amp; Jerry&#39;s &#x27;cat&#x27; &quot;x&quot;')).toBe(
      `Tom & Jerry's 'cat' "x"`,
    )
  })

  it('round-trips any text', () => {
    const text = `"<b>" & '&amp;' &#x27;`
    expect(decodeEntities(escapeHtml(text))).toBe(text)
  })

  it('leaves an unknown or out-of-range entity as it is', () => {
    expect(decodeEntities('&nbsp; &#99999999;')).toBe('&nbsp; &#99999999;')
  })
})

describe('escapeRegExp', () => {
  it('matches the text literally', () => {
    const text = 'side-card.[x](y)*?+^$|{}\\'
    expect(new RegExp(`^${escapeRegExp(text)}$`).test(text)).toBe(true)
    expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false)
  })
})
