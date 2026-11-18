import pg from 'pg'
import type { Payload } from 'payload'

import type { User } from '../src/payload-types'

export const RUN = crypto.randomUUID().slice(0, 8)

export const uniq = (base: string) => `${base}-${RUN}`

/** `base-<run>@cilas.test`. */
export const uniqEmail = (base: string) => `${uniq(base)}@cilas.test`

/** `/base-<run>`: a legacy path. Keeps `#fragment` or `.html` suffixes outside. */
export const uniqPath = (base: string) => `/${uniq(base)}`

const DELETE_ORDER = [
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
  'space-rsvps',
  'space-votes',
  'space-reactions',
  'space-preferences',
  'space-visits',
  'space-consents',
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
  const cleanup = async (payload: Payload) => {
    const rest = [...tracked.keys()].filter((c) => !DELETE_ORDER.includes(c)).reverse()
    const failed: string[] = []
    const refused: { collection: string; id: number; message: string }[] = []
    const accounts = tracked.get('users') ?? []
    if (accounts.length)
      for (const collection of ACCOUNT_ROWS)
        await payload
          .delete({
            collection,
            where: { account: { in: accounts } },
            overrideAccess: true,
          })
          .catch((error: Error) => void failed.push(`${collection}: ${error.message}`))
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
  return { track, cleanup }
}

const SPACES_MODE_LOCK = 7_300_001

/** Waits for the spaces-mode lock; the returned function releases it. */
export const lockSpacesMode = async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('select pg_advisory_lock($1)', [SPACES_MODE_LOCK])
  return async () => {
    await client.query('select pg_advisory_unlock($1)', [SPACES_MODE_LOCK])
    await client.end()
  }
}
