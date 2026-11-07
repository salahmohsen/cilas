import { relId } from '@/lib/relation'
import type { Payload } from 'payload'

import type { Role } from '@/access'
import type { User } from '@/payload-types'

/**
 * `fellow` is held by an account exactly while its linked person is listed on
 * at least one course. Courses list people; accounts are found through
 * `users.person`. A person with no account is simply skipped.
 */

/** Adds or removes `fellow`, never leaving roles empty (the field is required). */
export const withFellowRole = (roles: Role[], fellow: boolean): Role[] => {
  const rest = roles.filter((role) => role !== 'fellow')
  if (fellow) return [...rest, 'fellow']
  return rest.length > 0 ? rest : ['member']
}

export const toPersonIds = (fellows: Array<number | { id: number }> | null | undefined): number[] =>
  (fellows ?? [])
    .map((fellow) => relId(fellow))
    .filter((id): id is number => typeof id === 'number')

export const accountOf = async (payload: Payload, person: number): Promise<User | null> => {
  const res = await payload.find({
    collection: 'users',
    where: { person: { equals: person } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as User | undefined) ?? null
}

export const teaches = async (
  payload: Payload,
  person: number,
  exceptCourseId?: number,
): Promise<boolean> => {
  const res = await payload.find({
    collection: 'courses',
    where: {
      and: [
        { fellows: { contains: person } },
        ...(exceptCourseId === undefined ? [] : [{ id: { not_equals: exceptCourseId } }]),
      ],
    },
    limit: 1,
    depth: 0,
    // courses.read is tiered by `tier`, `_status` and ownership.
    overrideAccess: true,
  })
  return res.totalDocs > 0
}

export const grantFellow = async (payload: Payload, person: number): Promise<void> => {
  const account = await accountOf(payload, person)
  if (!account || account.roles.includes('fellow')) return

  await payload.update({
    collection: 'users',
    id: account.id,
    data: { roles: withFellowRole(account.roles, true) },
    // users.update is admin-only.
    overrideAccess: true,
  })
}

/** The course being saved or deleted is excluded so it cannot vouch for itself. */
export const revokeIfUnteaching = async (
  payload: Payload,
  person: number,
  exceptCourseId: number,
): Promise<void> => {
  if (await teaches(payload, person, exceptCourseId)) return

  const account = await accountOf(payload, person)
  if (!account || !account.roles.includes('fellow')) return

  await payload.update({
    collection: 'users',
    id: account.id,
    data: { roles: withFellowRole(account.roles, false) },
    overrideAccess: true,
  })
}
