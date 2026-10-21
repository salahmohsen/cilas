import config from '@payload-config'
import { createTranslator } from 'next-intl'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { getStudyCourses } from '@/api/courses.api'
import { facetOptions, filterCourses, type CourseQuery, type StudyCard } from '@/lib/course-search'
import { COURSES_TAG } from '@/lib/revalidate-courses'
import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

type Locale = 'en' | 'ar'

/**
 * The study list with its search words, built once per language and kept
 * until a course changes (or five minutes pass, for changes to the people,
 * cycles and places it names). Labels come straight from the messages: a
 * cached function cannot read the request.
 */
export const getStudyIndex = unstable_cache(
  async (locale: Locale) => {
    const payload = await getPayload({ config })
    const t = createTranslator({ locale, messages: locale === 'ar' ? ar : en, namespace: 'Study.filters' })
    return getStudyCourses(payload, locale, (key) => t(key as never))
  },
  // The key names the index's shape: a change to it starts a fresh cache.
  ['study-index-v4'],
  { tags: [COURSES_TAG], revalidate: 300 },
)

/** Courses on a page of the study list. */
export const STUDY_PAGE_SIZE = 20

/** What the page sends for one course: enough to show its row. */
export type StudyRow = Pick<StudyCard, 'id' | 'href' | 'title' | 'description' | 'image' | 'imageAlt'> & {
  /** Its course type, cycle (season and year) and place, each with its label. */
  type: { value: string; label: string }
  season?: { value: string; label: string }
  year?: string
  place?: string
}

export type StudyPage = {
  rows: StudyRow[]
  /** How many courses match, across all pages. */
  total: number
  page: number
  pageCount: number
  /** Each filter's values across all courses, with how many each has. */
  options: ReturnType<typeof facetOptions>
}

/**
 * One page of the study list, worked out on the server: the courses that
 * match the filters and search, newest first, cut to the page asked for.
 * Only that page's rows (and the filters' options) go to the browser.
 */
export const getStudyPage = async (locale: Locale, query: CourseQuery, page: number): Promise<StudyPage> => {
  const index = await getStudyIndex(locale)
  const matches = filterCourses(index, query)
  const pageCount = Math.max(1, Math.ceil(matches.length / STUDY_PAGE_SIZE))
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount)
  return {
    rows: matches
      .slice((current - 1) * STUDY_PAGE_SIZE, current * STUDY_PAGE_SIZE)
      .map(({ id, href, title, description, image, imageAlt, facets }) => ({
        id,
        href,
        title,
        description,
        image,
        imageAlt,
        type: facets.type?.[0] ?? { value: '', label: '' },
        ...(facets.season?.[0] ? { season: facets.season[0] } : {}),
        ...(facets.year?.[0] ? { year: facets.year[0].label } : {}),
        ...(facets.place?.[0] ? { place: facets.place[0].label } : {}),
      })),
    total: matches.length,
    page: current,
    pageCount,
    options: facetOptions(index),
  }
}
