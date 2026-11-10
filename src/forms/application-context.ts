import type { Payload } from 'payload'
import { courseRegistration } from '@/lib/registration'
import type { Reader } from '@/lib/reader'
import type { ApplicationContext } from './application-choices'
import type { ApplicationTarget } from './application-target'
import { openCoursesInCycle } from './open-courses'

export async function applicationContext(
  payload: Payload,
  context: ApplicationTarget,
  locale: 'en' | 'ar',
  reader: Reader = null,
): Promise<ApplicationContext> {
  const course = context.kind === 'courses' ? context.target : null
  const available =
    context.own && course
      ? [course]
      : context.cycle
        ? await openCoursesInCycle(payload, context.cycle, reader, locale)
        : []
  return {
    courses: available.map((item) => ({
      id: item.id,
      title: item.title,
      questions: item.applicant_questions ?? [],
      contribution: courseRegistration(item, context.cycle).price,
    })),
    initialCourse: course?.id,
    selectable: !context.own,
  }
}
