import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { SeedContext, PlaceSeed } from '../seed.type'
import { getOrCreateId, lexical } from '../seed.utils'

export const placesData: PlaceSeed[] = [
  {
    name: 'Darb el-Labbana',
    state: 'current',
    city: 'Cairo',
    city_ar: 'القاهرة',
    description: 'Current space in Cairo, facing the twin mosques of Sultan Hassan and al-Refai.',
  },
  {
    name: 'al-Ghuria',
    state: 'former',
    city: 'Cairo',
    city_ar: 'القاهرة',
    description:
      'Former space in Fatimid Cairo — a scholar’s residence in the side alleys of al-Ghuria.',
  },
  {
    name: 'al-Manshiya',
    state: 'former',
    city: 'Alexandria',
    city_ar: 'الإسكندرية',
    description: 'CILAS in Alexandria.',
  },
]

export const seedPlaces = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const place of placesData) {
    const { name, description, city_ar, ...rest } = place
    const id = await getOrCreateId(payload, 'places', { name: { equals: name } }, () =>
      payload.create({
        collection: 'places',
        data: {
          ...rest,
          name,
          slug: slugify(name),
          description: description ? lexical(description) : null,
        },
        overrideAccess: true,
      }),
    )
    if (city_ar) {
      await payload.update({
        collection: 'places',
        id,
        data: { city: city_ar },
        locale: 'ar',
        overrideAccess: true,
      })
    }
    ctx.places[name] = id
    console.log('place:', name)
  }
}
