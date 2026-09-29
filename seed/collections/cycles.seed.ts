import type { Payload } from 'payload'
import type { CycleSeed, SeedContext } from '../seed.type'
import { getOrCreateId } from '../seed.utils'

export const cyclesData: CycleSeed[] = [
    { label: 'Fall Cycle 2025', season: 'fall', year: 2025, mode: 'HYBRID' },
    { label: 'Spring Cycle 2026', season: 'spring', year: 2026, mode: 'OFFLINE' },
]

export const seedCycles = async (payload: Payload, ctx: SeedContext): Promise<void> => {
    for (const cycle of cyclesData) {
        const { label, ...rest } = cycle

        const id = await getOrCreateId(payload, 'cycles', { label: { equals: label } }, () =>
            payload.create({ collection: 'cycles', data: { ...rest, label }, overrideAccess: true }),
        )

        ctx.cycles[label] = id
        console.log('cycle:', label)
    }
}
