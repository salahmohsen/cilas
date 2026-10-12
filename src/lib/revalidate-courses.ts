import { revalidateTag } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/** The cache tag of everything built from courses (the study list). */
export const COURSES_TAG = 'courses'

/**
 * Drops the cached study list. Outside Next (seed and import scripts) there
 * is no cache, and revalidateTag throws: ignore it.
 */
const dropCache = () => {
  try {
    revalidateTag(COURSES_TAG, 'max')
  } catch {
    // Not in a Next request.
  }
}

export const revalidateCoursesAfterChange: CollectionAfterChangeHook = ({ doc }) => {
  dropCache()
  return doc
}

export const revalidateCoursesAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  dropCache()
  return doc
}
