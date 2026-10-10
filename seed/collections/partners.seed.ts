import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { PartnerSeed, SeedContext } from '../seed.type'
import { getOrCreateId } from '../seed.utils'

export const partnersData: PartnerSeed[] = [
  { name: 'Arab Council for the Social Sciences', kind: ['funder'], url: 'https://www.theacss.org' },
  { name: 'Ford Foundation', kind: ['funder'], url: 'https://www.fordfoundation.org' },
  { name: 'Mada Masr', kind: ['outlet'], url: 'https://www.madamasr.com' },
  { name: 'OpenDemocracy', kind: ['outlet'], url: 'https://www.opendemocracy.net' },
  { name: 'Egyptian Streets', kind: ['outlet'], url: 'https://egyptianstreets.com' },
  { name: 'Al-Fanar Media', kind: ['outlet'], url: 'https://www.al-fanarmedia.org' },
  { name: 'Mashallah News', kind: ['outlet'], url: 'https://www.mashallahnews.com' },
]

export const seedPartners = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const partner of partnersData) {
    ctx.partners[partner.name] = await getOrCreateId(
      payload,
      'partners',
      { name: { equals: partner.name } },
      () =>
        payload.create({
          collection: 'partners',
          data: { ...partner, slug: slugify(partner.name) },
          overrideAccess: true,
        }),
    )
    console.log('partner:', partner.name)
  }
}
