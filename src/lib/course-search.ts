/**
 * Searching and filtering the study list. Each course carries its facet
 * values (what the filters pick from) and its search words (every text it
 * has, in both languages); a query matches when each of its words occurs
 * within some word of the course.
 */

/** The filters, in the order the menu lists them; each is a URL parameter. */
export const COURSE_FACETS = ['type', 'season', 'year', 'academic', 'place', 'fellow', 'format', 'language'] as const
export type CourseFacet = (typeof COURSE_FACETS)[number]

/** `rank` orders values with a natural order (seasons, course types). */
export type FacetValue = { value: string; label: string; rank?: number }

export type StudyCourse = {
  id: number
  href: string
  title: string
  sublabel?: string
  description?: string
  image?: string
  imageAlt?: string
  /** Sorts the list: newest first. */
  startDate: string
  facets: Partial<Record<CourseFacet, FacetValue[]>>
  /** Unique normalised words, space separated. */
  words: string
}

/** A course as the page gets it: its words stay on the server (they are most of its size). */
export type StudyCard = Omit<StudyCourse, 'words'>

/**
 * Folds the differences a reader does not type: case, Latin accents, Arabic
 * diacritics and tatweel, and the alef, ya and ta marbuta variants.
 */
export const normaliseSearch = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670ـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')

const splitWords = (text: string): string[] => normaliseSearch(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean)

/** The unique words of all the given texts, for `StudyCourse.words`. */
export const searchWords = (texts: Array<string | null | undefined>): string =>
  [...new Set(texts.flatMap((t) => (t ? splitWords(t) : [])))].join(' ')

/** True when every word of the query occurs in the course's words. */
export const matchesQuery = (words: string, query: string): boolean => {
  const wanted = splitWords(query)
  if (!wanted.length) return true
  const haystack = ` ${words} `
  return wanted.every((w) => haystack.includes(w))
}

export type CourseQuery = { q?: string } & Partial<Record<CourseFacet, string>>

/** Reads the query and filters from URL parameters, ignoring anything else. */
export const readCourseQuery = (params: URLSearchParams): CourseQuery => {
  const query: CourseQuery = {}
  const q = params.get('q')?.trim()
  if (q) query.q = q
  for (const facet of COURSE_FACETS) {
    const value = params.get(facet)
    if (value) query[facet] = value.toLowerCase()
  }
  return query
}

/** True when the course has every chosen filter value. */
export const matchesFacets = (course: Pick<StudyCourse, 'facets'>, query: CourseQuery): boolean =>
  COURSE_FACETS.every((f) => !query[f] || (course.facets[f] ?? []).some((v) => v.value === query[f]))

/** The courses that match every chosen filter and the search words. */
export const filterCourses = (courses: StudyCourse[], query: CourseQuery): StudyCourse[] =>
  courses.filter((c) => matchesFacets(c, query) && matchesQuery(c.words, query.q ?? ''))

/**
 * Each facet's values across the courses, with how many courses have each:
 * the options the filter menu offers. Years sort newest first, ranked values
 * by rank, the rest by label.
 */
export const facetOptions = (
  courses: StudyCard[],
): Record<CourseFacet, Array<FacetValue & { count: number }>> => {
  const out = {} as Record<CourseFacet, Array<FacetValue & { count: number }>>
  for (const facet of COURSE_FACETS) {
    const seen = new Map<string, FacetValue & { count: number }>()
    for (const c of courses)
      for (const v of c.facets[facet] ?? []) {
        const known = seen.get(v.value)
        if (known) known.count++
        else seen.set(v.value, { ...v, count: 1 })
      }
    const values = [...seen.values()]
    out[facet] =
      facet === 'year' || facet === 'academic'
        ? values.sort((a, b) => b.value.localeCompare(a.value))
        : values.sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.label.localeCompare(b.label))
  }
  return out
}
