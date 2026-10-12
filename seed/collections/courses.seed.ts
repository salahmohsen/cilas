import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { CourseSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireIds } from '../seed.utils'

export const coursesData: CourseSeed[] = [
  /* === bridge programme semester one — core curriculum (enrolled CILASians) === */
  {
    course_type: 'CORE',
    tier: 'community',
    title: 'Historical Consciousness',
    description: `A core course of the bridge programme’s first semester: exposing students to histories and philosophies of the arts and sciences, some of the more prominent –isms of the modern age, and the ongoing debates around them.`,
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: [],
  },
  {
    course_type: 'CORE',
    tier: 'community',
    title: 'Philosophical and Poetic Inquiry',
    description: `A core course of the bridge programme’s first semester: trans-disciplinary, discussion-based inquiry into philosophical and poetic traditions, part of the intellectual and socio-emotional foundation for community-building.`,
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: [],
  },
  {
    course_type: 'CORE',
    tier: 'community',
    title: 'Ethnographic Study',
    description: `A core course of the bridge programme’s first semester: attending to everyday life, fieldwork, and writing culture, closing the core curriculum before the self-directed study period.`,
    location: ['OFFLINE'],
    cycle: 'fall-2025',
    fellows: [],
  },

]

export const seedCourses = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const course of coursesData) {
    const { title_ar, description, sessions, schedule, session_unit, fellows, cycle, ...rest } =
      course

    const id = await getOrCreateId(payload, 'courses', { title: { equals: course.title } }, () =>
      payload.create({
        collection: 'courses',
        data: {
          ...rest,
          title: course.title,
          slug: slugify(course.title),
          description: description ? lexical(description) : null,
          fellows: requireIds(ctx.people, fellows),
          cycle: requireIds(ctx.cycles, [cycle])[0],
          schedule,
          session_unit: session_unit ?? 'session',
          _status: 'published',
          sessions: (sessions ?? []).map(({ description, bibliography, ...s }) => ({
            ...s,
            description: description ? lexical(description) : null,
            bibliography: bibliography ?? [],
          })),
        },
        overrideAccess: true,
      }),
    )

    if (title_ar) {
      await payload.update({
        collection: 'courses',
        id,
        data: { title: title_ar },
        locale: 'ar',
        overrideAccess: true,
      })
    }

    ctx.courses[course.title] = id
    console.log('course:', course.title)
  }
}
