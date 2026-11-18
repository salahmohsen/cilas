import { describe, expect, it } from 'vitest'

import { linkTitles, parseMeta } from '@/lib/link-preview'
import {
  bareAddresses,
  pageAddresses,
  shortAddress,
  splitAddresses,
  threadTexts,
  titleKey,
} from '@/lib/link-title'

const URL_A =
  'https://cilas.salahmohsen.com/en/articles/on-reading-and-not-reading-theoretical-works'

describe('bare addresses', () => {
  it('finds a bare address and drops trailing punctuation', () => {
    expect(bareAddresses(`Read ${URL_A}.`)).toEqual([URL_A])
  })
  it('skips the target of a [text](url) link', () => {
    expect(bareAddresses(`[my text](${URL_A}) and [@Mona](/people/3)`)).toEqual([])
  })
  it('lists each distinct address once across a page, capped', () => {
    expect(pageAddresses([URL_A, `${URL_A} https://b.org/x`])).toEqual([URL_A, 'https://b.org/x'])
    expect(pageAddresses(['https://a.org/1 https://a.org/2 https://a.org/3'], 2)).toHaveLength(2)
  })
  it('splits comment text and keeps the punctuation after an address', () => {
    expect(splitAddresses(`see ${URL_A}, ok`)).toEqual(['see ', { url: URL_A, tail: ',' }, ' ok'])
  })
  it('reads the replies of a thread too', () => {
    expect(threadTexts(['post'], [{ body: 'c', replies: [{ body: 'r' }] }, { body: 'd' }])).toEqual(
      ['post', 'c', 'r', 'd'],
    )
  })
  it('keys an address without its trailing slash', () => {
    expect(titleKey('https://a.org/x/')).toBe('https://a.org/x')
  })
})

describe('title and fallback', () => {
  it('reads the page title from the head', () => {
    const html = '<head><title>On Reading and Not Reading Theoretical Works · CILAS</title></head>'
    expect(parseMeta(html, URL_A)?.title).toBe(
      'On Reading and Not Reading Theoretical Works · CILAS',
    )
  })
  it('shortens the address when there is no title', () => {
    const short = shortAddress(URL_A)
    expect(short).toHaveLength(48)
    expect(short.startsWith('cilas.salahmohsen.com/en/articles/')).toBe(true)
    expect(short.endsWith('…')).toBe(true)
    expect(shortAddress('https://www.example.org/')).toBe('example.org')
  })
  it('leaves out an address whose title cannot be fetched', async () => {
    expect(await linkTitles(['http://127.0.0.1:9/private'])).toEqual({})
  })
})

describe('title budget', () => {
  it('returns at once when the pages are slower than the budget', async () => {
    const started = Date.now()
    expect(await linkTitles(['http://127.0.0.1:9/slow'], 0)).toEqual({})
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
