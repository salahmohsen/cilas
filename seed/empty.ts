import type { Payload } from 'payload'

import type { User } from '@/payload-types'

type Role = 'admin' | 'fellow' | 'student'

/** A shared, known password: these accounts exist only in the local `cilas_empty` database. */
const PASSWORD = 'empty-seed'

export const EMPTY_ACCOUNTS: Record<
  Role,
  { email: string; password: string; roles: NonNullable<User['roles']> }
> = {
  admin: { email: 'admin@empty.cilas.test', password: PASSWORD, roles: ['admin'] },
  fellow: { email: 'fellow@empty.cilas.test', password: PASSWORD, roles: ['fellow'] },
  student: { email: 'student@empty.cilas.test', password: PASSWORD, roles: ['member'] },
}

const FELLOW_PERSON = { name: 'Empty Fellow', slug: 'empty-fellow' }

const findOne = async (
  payload: Payload,
  collection: 'users' | 'people',
  field: 'email' | 'slug',
  value: string,
) => {
  const { docs } = await payload.find({
    collection,
    where: { [field]: { equals: value } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0]
}

const fellowPerson = async (payload: Payload) =>
  (
    (await findOne(payload, 'people', 'slug', FELLOW_PERSON.slug)) ??
    (await payload.create({
      collection: 'people',
      data: { ...FELLOW_PERSON, visible: false },
      overrideAccess: true,
    }))
  ).id

/**
 * An empty world for empty-state screens: three accounts and nothing else.
 * Finds each account by email and creates only the missing ones, so a second
 * run changes nothing. The student's and fellow's `ensurePerson` hook gives
 * a person where none is passed; the admin gets none.
 */
export const seedEmpty = async (payload: Payload): Promise<Record<Role, number>> => {
  const ids = {} as Record<Role, number>
  for (const role of ['admin', 'fellow', 'student'] as const) {
    const { email, password, roles } = EMPTY_ACCOUNTS[role]
    const existing = await findOne(payload, 'users', 'email', email)
    if (existing) {
      ids[role] = existing.id
      continue
    }
    const person = role === 'fellow' ? await fellowPerson(payload) : undefined
    const created = await payload.create({
      collection: 'users',
      data: { email, password, roles, ...(person ? { person } : {}) },
      overrideAccess: true,
    })
    ids[role] = created.id
  }
  return ids
}
