// Shared fixtures for the integration specs. They share one Postgres, so every
// unique value (slug, email, legacy_url) carries a per-run suffix: rows left by
// an interrupted run never collide with the next run, and two spec files that
// run in parallel never collide with each other (vitest loads this module once
// per spec file, so each file draws its own suffix).
import pg from 'pg'
import type { Payload } from 'payload'

import type { User } from '../../src/payload-types'

export const RUN = crypto.randomUUID().slice(0, 8)

export const uniq = (base: string): string => `${base}-${RUN}`

/** `base-<run>@cilas.test`. */
export const uniqEmail = (base: string): string => `${uniq(base)}@cilas.test`

/** `/base-<run>`: a legacy path. Keeps `#fragment` or `.html` suffixes outside. */
export const uniqPath = (base: string): string => `/${uniq(base)}`

// Children first: Payload's required-relation FKs restrict, so a parent
// deleted before its children would leak the row.
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

/** The collections whose rows name the account that made them. */
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
  const track = <T extends number | { id: number }>(collection: string, row: T): T => {
    const id = typeof row === 'number' ? row : row.id
    const list = tracked.get(collection) ?? []
    list.push(id)
    tracked.set(collection, list)
    // An account made without a person gets a hidden one from the users hook,
    // under a slug the spec never sees, and a later link to another person
    // leaves it behind. Track it from the created account, which names it.
    const person = collection === 'users' && typeof row === 'object' ? (row as User).person : null
    if (person != null) track('people', typeof person === 'object' ? person.id : person)
    return row
  }
  const cleanup = async (payload: Payload) => {
    const rest = [...tracked.keys()].filter((c) => !DELETE_ORDER.includes(c)).reverse()
    const failed: string[] = []
    const refused: { collection: string; id: number; message: string }[] = []
    // What the app wrote for an account (a visit, a consent, a preference)
    // holds a restricting key to it, so the account cannot go while one is left.
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
    // A row refused while its parent stood may have gone with the parent since.
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

// `site-settings.spaces_mode` is one row for the whole database, and the
// spaces specs switch it on and restore it. They take this lock for their
// whole run, so two of them never switch it under each other.
const SPACES_MODE_LOCK = 7_300_001

/** Waits for the spaces-mode lock; the returned function releases it. */
export const lockSpacesMode = async (): Promise<() => Promise<void>> => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('select pg_advisory_lock($1)', [SPACES_MODE_LOCK])
  return async () => {
    await client.query('select pg_advisory_unlock($1)', [SPACES_MODE_LOCK])
    await client.end()
  }
}
