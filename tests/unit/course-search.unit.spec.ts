import { describe, expect, it } from 'vitest'

import {
  facetOptions,
  filterCourses,
  matchesQuery,
  normaliseSearch,
  readCourseQuery,
  searchWords,
  type StudyCourse,
} from '@/lib/course-search'

const course = (id: number, facets: StudyCourse['facets'], texts: string[]): StudyCourse => ({
  id,
  href: `/en/study/${id}`,
  title: texts[0],
  startDate: '2025-01-01',
  facets,
  words: searchWords(texts),
})

const lab = course(
  1,
  { type: [{ value: 'lab', label: 'Lab', rank: 2 }], year: [{ value: '2024', label: '2024' }] },
  ['Translation Lab', 'مختبر الترجمة', 'Walter Benjamin'],
)
const thematic = course(
  2,
  { type: [{ value: 'thematic', label: 'Thematic Course', rank: 1 }], year: [{ value: '2025', label: '2025' }] },
  ['Melancholia in the City', 'Surti Singh'],
)

describe('normaliseSearch', () => {
  it('folds case, accents and Arabic letter variants', () => {
    expect(normaliseSearch('Café')).toBe('cafe')
    expect(normaliseSearch('إِسْلامٌ')).toBe('اسلام')
    expect(normaliseSearch('مدرسة')).toBe(normaliseSearch('مدرسه'))
  })
})

describe('matchesQuery', () => {
  it('needs every word of the query, anywhere in a word', () => {
    expect(matchesQuery(lab.words, 'benjamin transl')).toBe(true)
    expect(matchesQuery(lab.words, 'benjamin city')).toBe(false)
    expect(matchesQuery(lab.words, 'الترجمه')).toBe(true)
    expect(matchesQuery(lab.words, '  ')).toBe(true)
  })
})

describe('readCourseQuery', () => {
  it('reads known filters and the search, ignoring the rest', () => {
    expect(readCourseQuery(new URLSearchParams('type=THEMATIC&q=%20city%20&page=2'))).toEqual({
      type: 'thematic',
      q: 'city',
    })
  })
})

describe('filterCourses', () => {
  it('keeps the courses matching every filter and the search', () => {
    expect(filterCourses([lab, thematic], { type: 'thematic' })).toEqual([thematic])
    expect(filterCourses([lab, thematic], { year: '2024', q: 'lab' })).toEqual([lab])
    expect(filterCourses([lab, thematic], { type: 'lab', q: 'city' })).toEqual([])
  })
})

describe('facetOptions', () => {
  it('counts each value, years newest first and ranked values by rank', () => {
    const options = facetOptions([lab, thematic, lab])
    expect(options.year.map((o) => o.value)).toEqual(['2025', '2024'])
    expect(options.type.map((o) => [o.value, o.count])).toEqual([
      ['thematic', 1],
      ['lab', 2],
    ])
  })
})
