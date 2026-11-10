import type { Payload, PayloadRequest } from 'payload'

import { siteTiers } from '@/access'
import { courseRegistration } from '@/lib/registration'
import { relId } from '@/lib/relation'
import { courseRegistrationMode } from '@/lib/course-registration'
import type { Reader } from '@/lib/reader'
import type { Course, Cycle } from '@/payload-types'

export const isOpenCourseInCycle = (
  course: Course,
  cycle: Cycle,
  reader: Reader,
  now: Date = new Date(),
): boolean =>
  relId(course.cycle) === cycle.id &&
  course._status === 'published' &&
  courseRegistrationMode(course.registration) === 'follow_cycle' &&
  siteTiers(reader).some((tier) => tier === course.tier) &&
  courseRegistration(course, cycle, now).status === 'open'

export const openCoursesInCycle = async (
  payload: Payload,
  cycle: Cycle,
  reader: Reader = null,
  locale: 'en' | 'ar' = 'en',
  req?: PayloadRequest,
): Promise<Course[]> => {
  const { docs } = await payload.find({
    collection: 'courses',
    locale,
    fallbackLocale: 'en',
    where: { cycle: { equals: cycle.id } },
    depth: 0,
    limit: 0,
    overrideAccess: true,
    req,
  })
  return docs.filter((course) => isOpenCourseInCycle(course, cycle, reader))
}
