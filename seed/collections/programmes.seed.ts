import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { ProgrammeSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireId, requireIds } from '../seed.utils'

export const programmesData: ProgrammeSeed[] = [
  {
    kind: 'bridge',
    title: 'Bridge Programme 2025–2026',
    // The two semester cycles; the academic year comes from them.
    cycles: ['fall-2025', 'spring-2026'],
    components: [
      { label: 'Core courses, fall semester', cycle: 'fall-2025', course_types: ['CORE'] },
      {
        label: 'Thematic courses and labs, fall semester',
        cycle: 'fall-2025',
        course_types: ['THEMATIC', 'LAB'],
      },
      { label: 'Core courses, spring semester', cycle: 'spring-2026', course_types: ['CORE'] },
      {
        label: 'Thematic courses and labs, spring semester',
        cycle: 'spring-2026',
        course_types: ['THEMATIC', 'LAB'],
      },
    ],
    weekly_hours: 15,
    self_directed_study: true,
    requirements: 'High school completed. A Bachelor’s degree is recommended but not required.',
    pricing: {
      min: 18000,
      need_based_deductions: true,
      payment_plans: [
        {
          label: 'Three instalments',
          installments: [{ amount: 6000 }, { amount: 6000 }, { amount: 6000 }],
        },
      ],
    },
  },
]

export const seedProgrammes = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { title, cycles, components, requirements, ...rest } of programmesData) {
    const id = await getOrCreateId(payload, 'programmes', { title: { equals: title } }, () =>
      payload.create({
        collection: 'programmes',
        data: {
          ...rest,
          title,
          slug: slugify(title),
          _status: 'published',
          cycles: requireIds(ctx.cycles, cycles),
          components: components.map(({ cycle, ...component }) => ({
            ...component,
            cycle: requireId(ctx.cycles, cycle),
          })),
          requirements: requirements ? lexical(requirements) : null,
        },
        overrideAccess: true,
      }),
    )

    ctx.programmes[title] = id
    console.log('programme:', title)
  }
}
