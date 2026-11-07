import { randomBytes } from 'node:crypto'

import type { PayloadRequest } from 'payload'

import { slugify } from '@/lib/slugify'

/**
 * A hidden person for an account that has none. A hidden person has no page,
 * so a slug made unique by a random suffix is enough. Returns the id.
 */
export const createPerson = async (req: PayloadRequest, name: string): Promise<number> => {
  const person = await req.payload.create({
    collection: 'people',
    data: {
      name,
      slug: `${slugify(name) || 'member'}-${randomBytes(3).toString('hex')}`,
      visible: false,
    },
    overrideAccess: true,
    depth: 0,
    req,
  })
  return person.id
}
