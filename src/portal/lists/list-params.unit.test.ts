import { describe, expect, it } from 'vitest'

import { MAX_PAGES, MAX_SEARCH_CHARS } from './groups'
import {
  controlsShown,
  DEFAULT_PARAMS,
  hrefOf,
  moreKindOf,
  nextPages,
  parseListParams,
  type ListParams,
} from './list-params'

const params = (overrides: Partial<ListParams> = {}) => ({ ...DEFAULT_PARAMS, ...overrides })

describe('parseListParams', () => {
  it('reads nothing as the defaults', () => {
    expect(parseListParams({})).toEqual(DEFAULT_PARAMS)
    expect(DEFAULT_PARAMS).toEqual({ q: null, show: null, pages: {}, focus: null })
  })

  it.each([
    ['needsYou', 'needsYou'],
    ['drafts', 'drafts'],
    ['published', 'published'],
    ['all', null],
    ['NEEDSYOU', null],
    ['', null],
  ])('show takes only the three chips (%j)', (show, expected) => {
    expect(parseListParams({ show }).show).toBe(expected)
  })

  it.each([
    ['2', 2],
    ['20', MAX_PAGES],
    ['21', MAX_PAGES],
    ['1', undefined],
    ['0', undefined],
    ['-3', undefined],
    ['2.5', undefined],
    ['abc', undefined],
    ['', undefined],
  ])('a page count is an integer from 1 to MAX_PAGES (%j), else 1', (value, expected) => {
    expect(parseListParams({ published: value }).pages.published).toBe(expected)
  })

  it('each paged group has its own count, and teaching names Teaching now', () => {
    expect(parseListParams({ published: '3', teaching: '4', closed: '5' }).pages).toEqual({
      published: 3,
      teachingNow: 4,
      closed: 5,
    })
  })

  it('q is trimmed, cut to 100 characters, and empty is null', () => {
    expect(parseListParams({ q: '  hello  ' }).q).toBe('hello')
    expect(parseListParams({ q: 'x'.repeat(150) }).q).toHaveLength(MAX_SEARCH_CHARS)
    expect(parseListParams({ q: '   ' }).q).toBeNull()
    expect(parseListParams({ q: ['first', 'second'] }).q).toBe('first')
  })

  it('q is the searched term: two characters at least, the first five words, one space between', () => {
    expect(parseListParams({ q: 'a' }).q).toBeNull()
    expect(parseListParams({ q: ' a ' }).q).toBeNull()
    expect(parseListParams({ q: 'ab' }).q).toBe('ab')
    expect(parseListParams({ q: 'one  two\tthree four five six seven' }).q).toBe(
      'one two three four five',
    )
  })

  it('q drops control characters, a null byte among them', () => {
    expect(parseListParams({ q: 'he\0llo' }).q).toBe('hello')
    expect(parseListParams({ q: '\u0007\u001b[0m' }).q).toBe('[0m')
    expect(parseListParams({ q: '\0\0' }).q).toBeNull()
    expect(parseListParams({ q: 'a\u007fb\u0085c' }).q).toBe('abc')
  })

  it.each([
    ['published', 'published'],
    ['teaching', 'teachingNow'],
    ['closed', 'closed'],
    ['teachingNow', null],
    ['needsYou', null],
  ])('focus takes only the three paged groups (%j)', (focus, expected) => {
    expect(parseListParams({ focus }).focus).toBe(expected)
  })
})

describe('hrefOf', () => {
  it.each(['en', 'ar'] as const)(
    'hrefOf prefixes the locale and leaves out default values, in a fixed order (%s)',
    (locale) => {
      expect(hrefOf('/spaces/articles', DEFAULT_PARAMS, locale)).toBe(`/${locale}/spaces/articles`)
      expect(
        hrefOf(
          '/spaces/courses',
          params({
            focus: 'teachingNow',
            pages: { closed: 2, teachingNow: 3 },
            show: 'published',
            q: 'a b',
          }),
          locale,
        ),
      ).toBe(`/${locale}/spaces/courses?q=a+b&show=published&teaching=3&closed=2&focus=teaching`)
    },
  )

  it('hrefOf gives back what parseListParams reads', () => {
    const value = params({
      q: 'café & co',
      show: 'drafts',
      pages: { published: 4 },
      focus: 'published',
    })
    const href = hrefOf('/spaces/articles', value, 'en')
    const query = Object.fromEntries(new URL(href, 'http://x').searchParams)
    expect(parseListParams(query)).toEqual(value)
  })
})

describe('controlsShown', () => {
  it.each([
    [6, {}, false],
    [7, {}, true],
    [0, { q: 'x' }, false],
    [0, { show: 'needsYou' as const }, false],
    [2, { q: 'x' }, true],
    [2, { show: 'needsYou' as const }, true],
  ])('controlsShown(%j, %j) is %j', (total, overrides, shown) => {
    expect(controlsShown(total, params(overrides))).toBe(shown)
  })
})

describe('nextPages', () => {
  it.each([
    [undefined, 2],
    [19, 20],
    [20, null],
  ])('nextPages gives the next count, and null at MAX_PAGES (%j)', (count, expected) => {
    expect(nextPages(params({ pages: count ? { published: count } : {} }), 'published')).toBe(
      expected,
    )
  })
})

describe('moreKindOf', () => {
  it.each([
    [null, undefined, 'link'],
    [null, 19, 'link'],
    [null, 20, 'pageCap'],
    ['x', undefined, 'link'],
    ['x', 19, 'link'],
    ['x', 20, 'pageCapSearch'],
  ] as const)('moreKindOf(%j, %j) is %j', (q, count, more) => {
    expect(moreKindOf(params({ q, pages: count ? { published: count } : {} }), 'published')).toBe(
      more,
    )
  })

  it('a group other than the one at MAX_PAGES still links', () => {
    expect(moreKindOf(params({ pages: { published: 20 } }), 'closed')).toBe('link')
  })
})
