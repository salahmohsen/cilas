import type { Payload } from 'payload'
import type { CycleSeed, SeedContext } from '../seed.type'
import { getOrCreateId, requireId } from '../seed.utils'

/**
 * Academic year 2025–2026 at Darb el-Labbana: one intake per season, each
 * holding every course type it offered (ADR 0003). Keyed `season-year`.
 */
export const cyclesData: CycleSeed[] = [
  { season: 'fall', start_year: 2025, place: 'Darb el-Labbana', start_date: '2025-10-19', deadline: '2025-10-10' },
  { season: 'winter', start_year: 2026, place: 'Darb el-Labbana', start_date: '2026-02-21', deadline: '2026-01-31' },
  { season: 'spring', start_year: 2026, place: 'Darb el-Labbana', start_date: '2026-04-25', deadline: '2026-04-15' },
  { season: 'summer', start_year: 2026, place: 'Darb el-Labbana', start_date: '2026-07-19', deadline: '2026-07-10' },
]

export const seedCycles = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { season, start_year, place, start_date, deadline } of cyclesData) {
    const key = `${season}-${start_year}`
    const id = await getOrCreateId(
      payload,
      'cycles',
      { and: [{ season: { equals: season } }, { start_year: { equals: start_year } }] },
      () =>
        payload.create({
          collection: 'cycles',
          data: {
            season,
            start_year,
            place: requireId(ctx.places, place),
            start_date,
            registration: { method: 'form', deadline },
          },
          overrideAccess: true,
        }),
    )

    ctx.cycles[key] = id
    console.log('cycle:', key, '->', id)
  }
}
