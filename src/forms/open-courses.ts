import type { Payload, PayloadRequest } from 'payload'

import { siteTiers } from '@/access'
import { courseRegistration } from '@/lib/registration'
import { relId } from '@/lib/relation'
import type { Course, Cycle } from '@/payload-types'

export const isOpenCourseInCycle = (
  course: Course,
  cycle: Cycle,
  reader: unknown,
  now: Date = new Date(),
): boolean =>
  relId(course.cycle) === cycle.id &&
  course._status === 'published' &&
  (course.registration?.mode ?? 'follow_cycle') === 'follow_cycle' &&
  siteTiers(reader).some((tier) => tier === course.tier) &&
  courseRegistration(course, cycle, now).status === 'open'

export const openCoursesInCycle = async (
  payload: Payload,
  cycleId: number,
  reader: unknown = null,
  req?: PayloadRequest,
): Promise<Course[]> => {
  const cycle = await payload.findByID({
    collection: 'cycles',
    id: cycleId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const { docs } = await payload.find({
    collection: 'courses',
    where: { cycle: { equals: cycleId } },
    depth: 0,
    limit: 0,
    overrideAccess: true,
    req,
  })
  return docs.filter((course) => isOpenCourseInCycle(course, cycle, reader))
}
