import type { Payload } from 'payload'
import type { Cycle } from '@/payload-types'
import type { CycleSeed, Draft, SeedContext } from '../seed.type'
import { getOrCreateId } from '../seed.utils'

/**
 * Academic year 2025–2026: every season the old site ran course cycles in —
 * fall semester of the bridge, the winter short-cycle, the spring semester,
 * and the summer round. Seasons are keyed by the calendar year they start in.
 */
export const cyclesData: CycleSeed[] = [
  { season: 'fall', year: 2025, mode: 'HYBRID' },
  { season: 'winter', year: 2026, mode: 'OFFLINE' },
  { season: 'spring', year: 2026, mode: 'OFFLINE' },
  { season: 'summer', year: 2026, mode: 'ONLINE' },
]

export const seedCycles = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const { season, year, mode } of cyclesData) {
    const key = `${season}-${year}`
    const title = `${season[0].toUpperCase()}${season.slice(1)} ${year}`
    const id = await getOrCreateId(payload, 'cycles', { title: { equals: title } }, () =>
      payload.create({
        collection: 'cycles',
        // `slug` is derived from `title` by collection hooks; `title` itself is
        // written here so a later run's idempotency query can find the season.
        // Cast: the draft-typed overload is for draft-enabled collections, and
        // Cycles has none — the payload types force this detour for
        // all-optional collections.
        data: { title, cycle: { season, year, mode } } as Draft<Cycle>,
        overrideAccess: true,
      }),
    )

    ctx.cycles[key] = id
    console.log('cycle:', key, '->', id)
  }
}
