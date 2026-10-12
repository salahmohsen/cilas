import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { CourseSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireIds, weekly } from '../seed.utils'

/** Expands `count` weekly sessions for a course whose flow PDF was not published. */
const shortSeries = (
  count: number,
  firstDate: string,
  start: string,
  end: string,
  theme?: string,
): ReturnType<typeof weekly> =>
  weekly(
    firstDate,
    start,
    end,
    Array.from({ length: count }, (_, i) => ({
      order: i + 1,
      session_title: theme && i === 0 ? theme : `Session ${i + 1}`,
    })),
  )

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

  /* === summer cycle 2026 — labs and workshops === */
  {
    course_type: 'LAB',
    tier: 'public',
    title: 'Writing the Self',
    title_ar: 'نكتب أنفسنا',
    description:
      'نكتب يومياتنا ونقفل عليها في درج بعيد عن أعين من نعرف، ونكتب جوابًا لحبيب على ملف Word ثم نغلق الملف بدون حفظ. ماذا يقول كل هذا عن ذواتنا؟ ولماذا نخاف مما نكتب عن أنفسنا؟ يهدف هذا المعمل إلى طرح المزيد من التساؤلات عن كتابة الذات، ونوعها، وما تثيره بداخلنا؛ وكيف تكون هذه الكتابات امتدادًا لذواتنا: تعبيرًا عن هويتنا وجندرنا. كما يهدف إلى التجريب في تلك الأنواع من الكتابة — ملحوظاتنا المنسية، أو اعترافاتنا الغريبة، أو جواباتنا غير مرسلة، أو تفاصيلنا اليومية التي لم نظن أن أحدًا سيهتم بها — وإلى تذوق ألوان أدبية ذاتية، والاشتباك مع نصوص نقدية نسوية حول الكتابة الذاتية. We write our diaries and lock them in a drawer away from the eyes of those we know. What does all this say about ourselves? And why are we afraid of what we write about ourselves?',
    location: ['ONLINE'],
    cycle: 'summer-2026',
    fellows: ['osamaamer@aucegypt.edu'],
    ...shortSeries(10, '2026-07-19', '19:00', '21:30'),
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
