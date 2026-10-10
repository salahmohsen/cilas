import type { Payload } from 'payload'
import { slugify } from '@/lib/slugify'
import type { SeedContext, SpaceSeed } from '../seed.type'
import { getOrCreateId, lexical } from '../seed.utils'

export const spacesData: SpaceSeed[] = [
  {
    name: 'Darb el-Labbana',
    state: 'current',
    city: 'Cairo',
    description: 'Current space in Cairo, facing the twin mosques of Sultan Hassan and al-Refai.',
  },
  {
    name: 'al-Ghuria',
    state: 'former',
    city: 'Cairo',
    description:
      'Former space in Fatimid Cairo — a scholar’s residence in the side alleys of al-Ghuria.',
  },
  { name: 'al-Manshiya', state: 'former', city: 'Alexandria', description: 'CILAS in Alexandria.' },
]

export const seedSpaces = async (payload: Payload, ctx: SeedContext): Promise<void> => {
  for (const space of spacesData) {
    const { name, description, ...rest } = space
    ctx.spaces[name] = await getOrCreateId(payload, 'spaces', { name: { equals: name } }, () =>
      payload.create({
        collection: 'spaces',
        data: {
          ...rest,
          name,
          slug: slugify(name),
          description: description ? lexical(description) : null,
        },
        overrideAccess: true,
      }),
    )
    console.log('space:', name)
  }
}
