import config from '@payload-config'
import { createTranslator } from 'next-intl'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

import { getStudyCourses } from '@/api/courses.api'
import { filterCourses, type CourseQuery, type StudyCard } from '@/lib/course-search'
import { COURSES_TAG } from '@/lib/revalidate-courses'
import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

type Locale = 'en' | 'ar'

/**
 * The study list with its search words, built once per language and kept
 * until a course changes (or five minutes pass, for changes to the people,
 * cycles and spaces it names). Labels come straight from the messages: a
 * cached function cannot read the request.
 */
export const getStudyIndex = unstable_cache(
  async (locale: Locale) => {
    const payload = await getPayload({ config })
    const t = createTranslator({ locale, messages: locale === 'ar' ? ar : en, namespace: 'Study.filters' })
    return getStudyCourses(payload, locale, (key) => t(key as never))
  },
  ['study-index'],
  { tags: [COURSES_TAG], revalidate: 300 },
)

/** The courses for the page, without their search words. */
export const getStudyCards = async (locale: Locale): Promise<StudyCard[]> =>
  (await getStudyIndex(locale)).map(({ words: _words, ...card }) => card)

/** The ids of the courses whose words match the search. */
export const searchStudy = async (locale: Locale, q: string): Promise<number[]> =>
  filterCourses(await getStudyIndex(locale), { q } satisfies CourseQuery).map((c) => c.id)
