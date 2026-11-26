import { Forbidden, type Payload } from 'payload'

import type { Locale } from '@/i18n/routing'
import type { Person, User } from '@/payload-types'

import { relation, relId } from './relation'
import type { ReviewRequest, ReviewState } from './review'
import type { ReviewedCollection } from './reviewed-fields'

export type ReviewHistoryRow = {
  at: string
  from: ReviewState
  to: ReviewState
  request: ReviewRequest | null
  note: string | null
  actorName: string | null
}

const readsLatestVersion = async (
  payload: Payload,
  collection: ReviewedCollection,
  id: number,
  user: User,
) => {
  try {
    const { docs } = await payload.findVersions({
      collection,
      where: { parent: { equals: id }, latest: { equals: true } },
      limit: 1,
      depth: 0,
      user,
      overrideAccess: false,
    })
    return docs.length > 0
  } catch (error) {
    // WARNING: `readVersions` that returns false, as for an account with no person, throws.
    if (error instanceof Forbidden) return false
    throw error
  }
}

const personNames = async (payload: Payload, accounts: number[], locale: Locale) => {
  const { docs } = await payload.find({
    collection: 'users',
    where: { id: { in: accounts } },
    depth: 1,
    select: { person: true },
    populate: { people: { name: true } },
    locale,
    pagination: false,
    overrideAccess: true,
  })
  return new Map(docs.map(({ id, person }) => [id, relation<Person>(person)?.name ?? null]))
}

/**
 * A document's review moves, oldest first, for a user who reads its latest
 * version (a current owner or an admin); anyone else gets none. A row names
 * the actor, in `locale`, and carries no account.
 */
export const reviewHistoryFor = async (
  payload: Payload,
  collection: ReviewedCollection,
  id: number,
  user: User,
  locale: Locale,
): Promise<ReviewHistoryRow[]> => {
  if (!(await readsLatestVersion(payload, collection, id, user))) return []
  const { docs: events } = await payload.find({
    collection: 'review-events',
    where: { and: [{ collection: { equals: collection } }, { doc: { equals: id } }] },
    sort: ['at', 'id'],
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const names = await personNames(
    payload,
    events.flatMap((event) => relId(event.actor) ?? []),
    locale,
  )
  return events.map(({ at, from, to, request, note, actor }) => ({
    at,
    from,
    to,
    request: request ?? null,
    note: note ?? null,
    actorName: names.get(relId(actor) ?? 0) ?? null,
  }))
}
