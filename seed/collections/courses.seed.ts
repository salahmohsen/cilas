import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { CourseSeed, SeedContext, SessionSeed } from '../seed.type'
import {
  getOrCreateId,
  lexical,
  reading,
  requireId,
  requireIds,
  watch,
  weekly,
} from '../seed.utils'

export const coursesData: CourseSeed[] = [
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Heroism and Modernity',
    title_ar: 'البطولة والحداثة',
    description:
      'Heroism and Modernity explores the anthropological, philosophical and theological changes experienced by modern man at the decisive moment of transition from the mythical age to the modern age. Through conversations and discussions, the course explores an array of readings ranging from philosophical analysis to commentary on literature and films that break down and illustrate the progression of the hero figure throughout history.',
    mode_note: 'Offline',
    location: ['OFFLINE'],
    fields_of_study: ['Philosophical and Poetic Inquiry'],
    cycle: 'Spring Cycle 2026',
    fellows: ['karim.eldalil@cilas.test'],
    sessions: weekly('2026-04-26', '18:00', '20:30', [
      {
        order: 1,
        week: '1',
        theme: 'The End of History',
        description: 'Introduction to the end of history concept and its effect on storytelling.',
        materials: [
          reading('The End of History', 'Frances Fukuyama'),
          reading('The End of History Illusion', 'Daniel Gilbert'),
          reading('Between Past and Future — Tradition and Modern Age', 'Hannah Arendt'),
        ],
      },
      {
        order: 2,
        week: '2',
        theme: 'Hegelian Heroes',
        description: 'Hegel’s definition of the dramatic and of heroism.',
        materials: [
          reading('Hegel’s Theory of Tragic Heroes', 'The Historical Progress of Subjectivity'),
          reading('Between Past and Future — The Concept of History', 'Hannah Arendt'),
        ],
      },
      {
        order: 3,
        week: '3',
        theme: 'The Consumption of Heroes',
        description: 'The transition from mythical to modern heroes.',
        materials: [
          reading('Philosophy by Other Means', 'Robert Pippin'),
          reading('The Gay Science (books 3, 5)', 'Friedrich Nietzsche'),
        ],
      },
      {
        order: 4,
        week: '4',
        theme: 'The Western Hero',
        description: 'The western genre as a new mythmaking device.',
        materials: [
          reading('Hollywood Westerns and the American Myth', 'Robert Pippin'),
          watch('The Man Who Shot Liberty Valance', 'John Ford'),
        ],
      },
      {
        order: 5,
        week: '5',
        theme: 'The Noir Hero',
        description: 'The noir hero as a development of heroes in the modern age.',
        materials: [
          reading('Tarrying with the Negative', 'Slavoj Žižek'),
          reading('Between Past and Future — The Gap Between Past and Future', 'Hannah Arendt'),
        ],
      },
      {
        order: 6,
        week: '6',
        theme: 'End of History Storytelling',
        description: 'Fight Club and The Matrix as end-of-history storytelling.',
        materials: [
          reading('The Matrix and Philosophy', 'Sarah E. Worth'),
          reading('Between Past and Future — The Crisis in Culture', 'Hannah Arendt'),
        ],
      },
    ]),
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Buddhist Psychology',
    description:
      'This course covers the psychological aspects of the Buddhist doctrine, exploring the origins and developments of the Indian experience of mind-examination — from dukkha to meditation, tranquillity, mindfulness and renunciation — read against modern Western psychology.',
    mode_note: 'Offline',
    location: ['OFFLINE'],
    fields_of_study: ['Philosophical and Poetic Inquiry'],
    cycle: 'Spring Cycle 2026',
    fellows: ['mahaviveka@cilas.test'],
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Place in Modern Arabic Literature',
    title_ar: 'المكان في الأدب الحديث',
    description:
      'حلقة دراسية من ثماني جلسات تستكشف علاقة الجغرافيا بالأدب، ودور المكان المتعاظم في الأدب الحديث، مع قراءات تطبيقية لأعمال أدبية من زاوية النظر تلك.',
    mode_note: 'Offline',
    location: ['OFFLINE'],
    fields_of_study: ['Historical Consciousness'],
    cycle: 'Spring Cycle 2026',
    fellows: ['yasser@cilas.test'],
  },
  {
    course_type: 'THEMATIC',
    tier: 'public',
    title: 'Modernity and the Ecological Crisis',
    title_ar: 'الحداثة والأزمة البيئية: لماذا لا نستطيع إلا أن ندمّر العالم',
    description:
      'Why We Can’t Help but Destroy the World. This course identifies the material, social, and philosophical processes that define Modernity and how they contribute to the ecological crisis, calling into question Modernity’s conception of nature as an objective domain to be exploited, and exploring methods proposed by scholars to realize the possibility of a different world(s).',
    mode_note: 'Offline',
    location: ['OFFLINE'],
    fields_of_study: ['Ethnographic Study'],
    cycle: 'Spring Cycle 2026',
    fellows: ['ahmad.mahana@cilas.test'],
    sessions: weekly('2026-04-30', '18:00', '20:30', [
      {
        order: 1,
        week: '1',
        theme: 'Nature, Society, and the Anthropocene: An Introduction',
        materials: [
          reading('Anthropocene', 'Chua, Liana & Hannah Fair (2019/2023)'),
          reading(
            'Nature and Society: Anthropological Perspectives',
            'Descola, P. & Pálsson, G. (1996)',
          ),
        ],
      },
      {
        order: 2,
        week: '2',
        theme: 'Splitting Nature and Culture: Modern Phenomenon or Ancient Ordeal?',
        materials: [
          reading('We Have Never Been Modern', 'Latour, B. (1993)'),
          reading('Meditations on First Philosophy', 'Descartes, R. (1641)'),
          reading('The Ax of Gilgamesh: Splitting Nature and Culture', 'Elmusa, S. S. (2003)'),
        ],
      },
      {
        order: 3,
        week: '3',
        theme: 'Political Ecology and Climate Crisis',
        materials: [
          reading('The political ontology of climate change', 'Burman, A. (2017)'),
          reading(
            'Uncommoning nature: Stories from the Anthropo-Not-Seen',
            'de la Cadena, M. (2015)',
          ),
        ],
      },
      {
        order: 4,
        week: '4',
        theme: 'Techno-politics and Associative Sociology',
        materials: [
          reading('Can the Mosquito Speak?', 'Mitchell, T. (2002)'),
          reading(
            'Reassembling the Social: an Introduction to Actor-Network-Theory',
            'Latour, B. (2005)',
          ),
        ],
      },
      {
        order: 5,
        week: '5',
        theme: 'More-Than-Human Anthropology: Multispecies Ethnography',
        materials: [
          reading('Unruly Edges: Mushrooms as Companion Species', 'Tsing, A. (2012)'),
          reading(
            'Staying With the Trouble: Making Kin in the Chthulucene',
            'Haraway, D. J. (2016)',
          ),
        ],
      },
      {
        order: 6,
        week: '6',
        theme: 'Anthropology, Ontology, and Radical Alterity',
        materials: [
          reading(
            'Cosmological Deixis and Amerindian Perspectivism',
            'Viveiros de Castro, E. (1998)',
          ),
          reading('The Ontological Turn', 'Holbraad, M. & Pedersen, M. A. (2017)'),
        ],
      },
      {
        order: 7,
        week: '7',
        theme: 'Animating the inanimate: Pushing the Epistemological Limits of Modernity',
        materials: [
          reading('Rethinking the animate, re-animating thought', 'Ingold, T. (2006)'),
          reading('Shakhṣīyat Miṣr [The Personality of Egypt]', 'Hemdan, J. (1980)'),
        ],
      },
      {
        order: 8,
        week: '8',
        theme: 'Semiotics and Cybernetics: Is Meaning Embedded in the Universe?',
        materials: [
          reading('Steps to an Ecology of Mind', 'Bateson, G. (1972)'),
          reading('How Forests Think', 'Kohn, E. (2013)'),
        ],
      },
    ]),
  },
]

const toSession = ({ description, materials, ...rest }: SessionSeed) => ({
  ...rest,
  description: description ? lexical(description) : null,
  materials: materials ?? [],
})

export const seedCourses = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  const courseIdsByCycle = new Map<string, number[]>()

  for (const course of coursesData) {
    const { title_ar, description, sessions, fellows, fields_of_study, cycle, ...rest } = course

    const id = await getOrCreateId(payload, 'courses', { title: { equals: course.title } }, () =>
      payload.create({
        collection: 'courses',
        data: {
          ...rest,
          title: course.title,
          slug: slugify(course.title),
          description: description ? lexical(description) : null,
          fellows: requireIds(ctx.users, fellows),
          fields_of_study: requireIds(ctx.fieldsOfStudy, fields_of_study),
          cycle: requireId(ctx.cycles, cycle),
          sessions: (sessions ?? []).map(toSession),
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
    courseIdsByCycle.set(cycle, [...(courseIdsByCycle.get(cycle) ?? []), id])
    console.log('course:', course.title)
  }

  // Back-link cycles.courses, so the calendar view can walk cycle -> courses.
  for (const [label, courseIds] of courseIdsByCycle) {
    await payload.update({
      collection: 'cycles',
      id: requireId(ctx.cycles, label),
      data: { courses: courseIds },
      overrideAccess: true,
    })
  }
}
