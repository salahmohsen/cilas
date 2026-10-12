'use server'

import { searchStudy } from '@/api/study-index'

/** The ids of the courses matching a search, for the study list. */
export async function searchCourses(locale: string, q: string): Promise<number[]> {
  return searchStudy(locale === 'ar' ? 'ar' : 'en', q.slice(0, 200))
}
