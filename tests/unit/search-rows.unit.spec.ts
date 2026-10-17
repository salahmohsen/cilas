import { describe, expect, it } from 'vitest'

import {
  contributorsOf,
  mergeRows,
  shapeSnippet,
  snippetFieldOf,
  titleFieldOf,
  type SearchHit,
  type SearchRow,
} from '@/lib/search-rows'

const marked = (value: string) => ({ value: `<mark>${value}</mark>`, matchLevel: 'full' })
const plain = (value: string) => ({ value, matchLevel: 'none' })

const hit = (id: string, fields: Partial<SearchHit> = {}): SearchHit => ({ objectID: id, ...fields })
const row = (collection: SearchRow['collection'], value: SearchHit): SearchRow => ({
  id: `${collection}:${value.objectID}`,
  collection,
  hit: value,
})

describe('titleFieldOf', () => {
  const both = hit('1', { title_en: 'Reading Plato', title_ar: 'قراءة أفلاطون' })

  it('shows the site language', () => {
    expect(titleFieldOf(row('courses', both), 'ar')).toBe('title_ar')
    expect(titleFieldOf(row('courses', both), 'en')).toBe('title_en')
  })

  it('shows the other language when only it matched', () => {
    const matchedArabic = { ...both, _highlightResult: { title_en: plain('Reading Plato'), title_ar: marked('قراءة') } }
    expect(titleFieldOf(row('courses', matchedArabic), 'en')).toBe('title_ar')
  })

  it('falls back when the site language has no title', () => {
    expect(titleFieldOf(row('people', hit('2', { name_en: '', name_ar: 'علي' })), 'en')).toBe('name_ar')
  })
})

describe('snippetFieldOf', () => {
  it('quotes the first matched field, site language first', () => {
    const value = hit('1', {
      _snippetResult: {
        description_en: plain('whole text'),
        description_ar: marked('نص'),
        syllabus_en: marked('Plato'),
      },
    })
    expect(snippetFieldOf(row('courses', value), 'en')).toBe('description_ar')
    expect(snippetFieldOf(row('courses', value), 'ar')).toBe('description_ar')
  })

  it('quotes nothing for a title-only match', () => {
    expect(snippetFieldOf(row('articles', hit('1', { _snippetResult: { body_en: plain('…') } })), 'en')).toBeNull()
  })
})

describe('contributorsOf', () => {
  it('names each contributor in the site language where known', () => {
    const contributors = JSON.stringify([
      { name: { en: 'Iman Mersal', ar: 'إيمان مرسال' }, photo: 'https://cdn/iman.webp' },
      { name: { en: 'Ali' }, photo: '/relative.webp' },
    ])
    expect(contributorsOf(hit('1', { contributors }), 'ar')).toEqual([
      { name: 'إيمان مرسال', src: 'https://cdn/iman.webp' },
      { name: 'Ali' },
    ])
  })

  it('survives a malformed field', () => {
    expect(contributorsOf(hit('1', { contributors: '{' }), 'en')).toEqual([])
  })
})

describe('shapeSnippet', () => {
  it('keeps the sentences holding the matches', () => {
    expect(shapeSnippet('like ours. What <mark>Plato</mark> said. And then')).toBe('What <mark>Plato</mark> said.')
  })

  it('treats a line break as a sentence edge', () => {
    expect(shapeSnippet('What to Expect\nThe <mark>course</mark> reads\nNext')).toBe('The <mark>course</mark> reads')
  })

  it('spans every match', () => {
    expect(shapeSnippet('A. One <mark>x</mark>. Two <mark>x</mark>! Three.')).toBe('One <mark>x</mark>. Two <mark>x</mark>!')
  })

  it('keeps the window edge when no boundary is near', () => {
    expect(shapeSnippet('torn <mark>match</mark> text')).toBe('torn <mark>match</mark> text')
    expect(shapeSnippet('no match here')).toBe('no match here')
  })

  it('ends Arabic sentences on the Arabic question mark', () => {
    expect(shapeSnippet('قبل. ماذا قال <mark>أفلاطون</mark>؟ بعد')).toBe('ماذا قال <mark>أفلاطون</mark>؟')
  })
})

describe('mergeRows', () => {
  const visible = () => true
  const results = {
    courses: { hits: [hit('c1', { title_en: 'A' }), hit('c2', { title_en: 'B' })], found: 2 },
    articles: { hits: [hit('a1', { title_en: 'C' })], found: 1 },
    people: {
      hits: [hit('p1', { name_en: 'Naguib' }), hit('p2', { name_en: 'Reem Naguib' })],
      found: 2,
    },
  }

  it('interleaves collections, exact names first and weak names last', () => {
    const ids = mergeRows({ results, visible, sort: 'relevance', query: 'naguib', locale: 'en' }).map((entry) => entry.id)
    expect(ids).toEqual(['people:p1', 'courses:c1', 'articles:a1', 'courses:c2', 'people:p2'])
  })

  it('skips hidden collections', () => {
    const rows = mergeRows({
      results,
      visible: (collection) => collection !== 'people',
      sort: 'relevance',
      query: '',
      locale: 'en',
    })
    expect(rows.every((entry) => entry.collection !== 'people')).toBe(true)
  })

  it('merges by date and holds back rows past a shortened list', () => {
    const rows = mergeRows({
      results: {
        // Two more courses wait on the server, all older than 30.
        courses: { hits: [hit('c1', { updatedAt: 50 }), hit('c2', { updatedAt: 30 })], found: 4 },
        articles: { hits: [hit('a1', { updatedAt: 40 }), hit('a2', { updatedAt: 10 })], found: 2 },
      },
      visible,
      sort: 'newest',
      query: '',
      locale: 'en',
    })
    expect(rows.map((entry) => entry.id)).toEqual(['courses:c1', 'articles:a1', 'courses:c2'])
  })

  it('sorts A to Z on the reading language’s sort title', () => {
    const rows = mergeRows({
      results: {
        courses: { hits: [hit('c1', { sortTitle_ar: 'ب' })], found: 1 },
        articles: { hits: [hit('a1', { sortTitle_ar: 'أ' })], found: 1 },
      },
      visible,
      sort: 'alpha',
      query: '',
      locale: 'ar',
    })
    expect(rows.map((entry) => entry.id)).toEqual(['articles:a1', 'courses:c1'])
  })
})
