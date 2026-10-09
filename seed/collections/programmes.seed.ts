import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { ProgrammeSeed, SeedContext } from '../seed.type'
import { getOrCreateId, lexical, requireIds } from '../seed.utils'

export const programmesData: ProgrammeSeed[] = [
    {
        title: 'Bridge Programme 2025–2026',
        kind: 'BRIDGE',
        academic_year: '2025–2026',
        cycles: ['Fall Cycle 2025', 'Spring Cycle 2026'],
        tuition: { amount: 18000, installments: 3, need_based_deductions: true },
        weekly_hours: 15,
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
