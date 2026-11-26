import pg from 'pg'
import type { CollectionSlug, Payload, Where } from 'payload'

import { REVIEWED } from '../src/lib/reviewed-collections'
import type { User } from '../src/payload-types'

export const RUN = crypto.randomUUID().slice(0, 8)

export const uniq = (base: string) => `${base}-${RUN}`

/** `base-<run>@cilas.test`. */
export const uniqEmail = (base: string) => `${uniq(base)}@cilas.test`

/** `/base-<run>`: a legacy path. Keeps `#fragment` or `.html` suffixes outside. */
export const uniqPath = (base: string) => `/${uniq(base)}`

const DELETE_ORDER = [
  'form-submissions',
  'space-rsvps',
  'space-votes',
  'space-reactions',
  'space-files',
  'space-preferences',
  'space-visits',
  'space-consents',
  'space-comments',
  'notifications',
  'space-posts',
  'spaces',
  'sessions',
  'enrollments',
  'memberships',
  'courses',
  'programmes',
  'publications',
  'articles',
  'press',
  'cycles',
  'places',
  'users',
  'people',
]

const ACCOUNT_ROWS = [
  ['space-rsvps', 'account'],
  ['space-votes', 'account'],
  ['space-reactions', 'account'],
  ['space-preferences', 'account'],
  ['space-visits', 'account'],
  ['space-consents', 'account'],
  ['notifications', 'recipient'],
  ['invitation-log', 'user'],
  ['payload-mcp-api-keys', 'user'],
] as const

/**
 * Records the rows a spec creates and deletes them in `afterAll`.
 * `track` returns what it was given, so it wraps a create call in place.
 */
export const createTracker = () => {
  const tracked = new Map<string, number[]>()
  const track = <T extends number | { id: number }>(collection: string, row: T) => {
    const id = typeof row === 'number' ? row : row.id
    const list = tracked.get(collection) ?? []
    list.push(id)
    tracked.set(collection, list)
    const person = collection === 'users' && typeof row === 'object' ? (row as User).person : null
    if (person != null) track('people', typeof person === 'object' ? person.id : person)
    return row
  }
  const trackMatching = async (payload: Payload, collection: CollectionSlug, where: Where) => {
    const { docs } = await payload.find({
      collection,
      where,
      depth: 0,
      pagination: false,
      select: {},
      overrideAccess: true,
    })
    for (const { id } of docs) track(collection, id)
  }
  const cleanup = async (payload: Payload) => {
    const rest = [...tracked.keys()].filter((c) => !DELETE_ORDER.includes(c)).reverse()
    const failed: string[] = []
    const refused: { collection: string; id: number; message: string }[] = []
    const accounts = tracked.get('users') ?? []
    if (accounts.length) {
      const { docs } = await payload.find({
        collection: 'users',
        where: { id: { in: accounts } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
      for (const { person } of docs)
        if (person != null) track('people', typeof person === 'object' ? person.id : person)
    }
    if (accounts.length)
      for (const [collection, field] of ACCOUNT_ROWS)
        await payload
          .delete({
            collection,
            where: { [field]: { in: accounts } },
            overrideAccess: true,
          })
          .catch((error: Error) => void failed.push(`${collection}: ${error.message}`))
    // WARNING: a history row stays when its document is deleted, so the tracker removes it.
    for (const { collection } of REVIEWED) {
      const docs = tracked.get(collection)
      if (!docs) continue
      await payload
        .delete({
          collection: 'review-events',
          where: { and: [{ collection: { equals: collection } }, { doc: { in: docs } }] },
          overrideAccess: true,
        })
        .catch((error: Error) => void failed.push(`review-events: ${error.message}`))
    }
    for (const collection of [...DELETE_ORDER, ...rest]) {
      for (const id of [...(tracked.get(collection) ?? [])].reverse()) {
        await payload
          .delete({ collection: collection as never, id, overrideAccess: true })
          .catch((error: Error) => void refused.push({ collection, id, message: error.message }))
      }
    }
    for (const { collection, id, message } of refused) {
      const { totalDocs } = await payload.count({
        collection: collection as never,
        where: { id: { equals: id } },
        overrideAccess: true,
      })
      if (totalDocs) failed.push(`${collection} ${id}: ${message}`)
    }
    if (failed.length) throw new Error(`Cleanup left rows behind:\n${failed.join('\n')}`)
  }
  return { track, trackMatching, cleanup }
}

const holdLock = async (key: number, mode: 'shared' | 'alone') => {
  const shared = mode === 'shared' ? '_shared' : ''
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query(`select pg_advisory_lock${shared}($1)`, [key])
  return async () => {
    await client.query(`select pg_advisory_unlock${shared}($1)`, [key])
    await client.end()
  }
}

/** Waits for the spaces-mode lock; the returned function releases it. */
export const lockSpacesMode = () => holdLock(7_300_001, 'alone')

/**
 * The day's invitation count is one number for the whole database, and bulk
 * invitations stop at its cap. A file that sends invitations holds this
 * shared while it runs; a test that fills the count to the cap holds it alone.
 * The returned function releases it.
 */
export const holdInvitationBudget = (mode: 'shared' | 'alone') => holdLock(7_300_002, mode)
