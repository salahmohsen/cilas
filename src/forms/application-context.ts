import type { Payload } from 'payload'
import { courseRegistration } from '@/lib/registration'
import { mediaImage, mediaPopulate } from '@/lib/media-image'
import type { Reader } from '@/lib/reader'
import { relId } from '@/lib/relation'
import type { Course, Media } from '@/payload-types'
import type { ApplicationContext } from './application-choices'
import type { ApplicationTarget } from './application-target'
import { openCoursesInCycle } from './open-courses'

/** Course covers arrive as ids or documents, depending on the query depth. One lookup fills the ids. */
async function coversOf(payload: Payload, courses: Course[]) {
  const ids = courses
    .map((course) => course.cover_image)
    .filter((cover): cover is number => typeof cover === 'number')
  const found = ids.length
    ? (
        await payload.find({
          collection: 'media',
          where: { id: { in: ids } },
          select: mediaPopulate,
          depth: 0,
          limit: ids.length,
          pagination: false,
          overrideAccess: true,
        })
      ).docs
    : []
  const byId = new Map(found.map((media) => [media.id, media as Media]))
  return (course: Course) =>
    mediaImage(
      typeof course.cover_image === 'object'
        ? course.cover_image
        : byId.get(relId(course.cover_image) as number),
    )
}

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
  const cover = await coversOf(payload, available)
  return {
    courses: available.map((item) => ({
      id: item.id,
      title: item.title,
      cover: cover(item),
      questions: item.applicant_questions ?? [],
      contribution: courseRegistration(item, context.cycle).price,
    })),
    initialCourse: course?.id,
    selectable: !context.own,
  }
}
