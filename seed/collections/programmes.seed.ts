import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { ProgrammeSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireIds } from '../seed.utils'

export const programmesData: ProgrammeSeed[] = [
  {
    title: 'Bridge Programme 2025–2026',
    // The academic year is derived from the bound cycles, not stored: fall
    // 2025 + spring 2026 = 2025–2026.
    cycles: ['fall-2025', 'winter-2026', 'spring-2026', 'summer-2026'], // ordered: fall → summer
    weekly_hours: 15, // ≥15
    amount: 18000,
    installments: 3,
    need_based_deductions: true,
    admission_requirements:
      'High school completed. A Bachelor’s degree is recommended but not required.',
    self_directed_study: true,
  },
]

export const seedProgrammes = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const programme of programmesData) {
    const { title, cycles, admission_requirements, ...rest } = programme

    const id = await getOrCreateId(
      payload,
      'programmes',
      { title: { equals: title } },
      () =>
        payload.create({
          collection: 'programmes',
          data: {
            ...rest,
            title,
            slug: slugify(title),
            cycles: requireIds(ctx.cycles, cycles),
            admission_requirements: admission_requirements
              ? lexical(admission_requirements)
              : null,
          },
          overrideAccess: true,
        }),
    )

    ctx.programmes[title] = id
    console.log('programme:', title)
  }
}
