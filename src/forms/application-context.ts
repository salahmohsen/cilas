import type { Payload } from 'payload'
import { courseRegistration } from '@/lib/registration'
import { relId } from '@/lib/relation'
import type { Course, Cycle } from '@/payload-types'
import type { ApplicationContext } from './application-choices'
import { openCoursesInCycle } from './open-courses'

export async function applicationContext(
  payload: Payload,
  context: Course | Cycle,
  locale: 'en' | 'ar',
  reader: unknown = null,
): Promise<ApplicationContext> {
  const course = 'course_type' in context ? (context as Course) : null
  const own = course?.registration?.mode === 'own'
  const cycleId = course ? relId(course.cycle) : context.id
  const cycle = cycleId
    ? await payload.findByID({ collection: 'cycles', id: cycleId, depth: 0 })
    : null
  const available = own
    ? [course!]
    : cycle
      ? await openCoursesInCycle(payload, cycle.id, reader)
      : []
  const courses = await Promise.all(
    available.map(async (item) => {
      const localized = await payload.findByID({
        collection: 'courses',
        id: item.id,
        locale,
        fallbackLocale: 'en',
        depth: 0,
      })
      return {
        id: localized.id,
        title: localized.title,
        questions: localized.applicant_questions ?? [],
        contribution: courseRegistration(localized, cycle).price,
      }
    }),
  )
  return { courses, initialCourse: course?.id, selectable: !own }
}
