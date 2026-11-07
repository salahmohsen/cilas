// Shared fixtures for the integration specs. They share one Postgres, so every
// unique value (slug, email, legacy_url) carries a per-run suffix: rows left by
// an interrupted run never collide with the next run, and two spec files that
// run in parallel never collide with each other (vitest loads this module once
// per spec file, so each file draws its own suffix).
import pg from 'pg'
import type { Payload } from 'payload'

export const RUN = crypto.randomUUID().slice(0, 8)

/** `base-<run>`: for slugs, legacy URL fragments and anything else unique. */
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
    return row
  }
  const cleanup = async (payload: Payload) => {
    const rest = [...tracked.keys()].filter((c) => !DELETE_ORDER.includes(c)).reverse()
    for (const collection of [...DELETE_ORDER, ...rest]) {
      for (const id of [...(tracked.get(collection) ?? [])].reverse()) {
        await payload
          .delete({ collection: collection as never, id, overrideAccess: true })
          .catch(() => undefined)
      }
    }
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
