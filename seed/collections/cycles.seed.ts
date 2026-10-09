import type { Payload } from 'payload'
import type { CycleSeed, SeedContext } from '../seed.type'
import { slugify } from '@/lib/slugify'
import { getOrCreateId } from '../seed.utils'

export const cyclesData: CycleSeed[] = [
  { season: 'fall', year: 2025, mode: 'HYBRID' },
  { season: 'spring', year: 2026, mode: 'OFFLINE' },
]

export const seedCycles = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const cycle of cyclesData) {
    const id = await getOrCreateId(
      payload,
      'cycles',
      { season: { equals: cycle.season }, year: { equals: cycle.year } },
      () =>
        payload.create({
          collection: 'cycles',
          data: [{ slug: slugify(`${cycle.season}-${cycle.year}`), ...cycle }],
          overrideAccess: true,
        }),
    )

    ctx.cycles[`${cycle.season}-${cycle.year}`] = id
    console.log('cycle:', cycle.season, cycle.year, '->', id)
  }
}
