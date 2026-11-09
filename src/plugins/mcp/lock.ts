import { createHash } from 'node:crypto'
import pg from 'pg'
import type { Payload } from 'payload'

const pools = new WeakMap<Payload, pg.Pool>()

const lockPool = (payload: Payload): pg.Pool => {
  let pool = pools.get(payload)
  if (!pool) {
    // Locks must not occupy the connections the work inside the lock needs.
    pool = new pg.Pool({
      ...payload.db.pool.options,
      max: 2,
      idleTimeoutMillis: 1000,
      allowExitOnIdle: true,
    })
    pool.on('error', (error) =>
      payload.logger.error({ err: error }, 'Assistant lock connection failed'),
    )
    pools.set(payload, pool)
  }
  return pool
}

/** A database session lock covers plugin calls that open their own transactions. */
export async function withAssistantLock<T>(
  payload: Payload,
  key: string,
  busy: () => T,
  work: () => Promise<T> | T,
): Promise<T> {
  const digest = createHash('sha256').update(key).digest()
  const args = [digest.readInt32BE(0), digest.readInt32BE(4)]
  const client = await lockPool(payload).connect()
  let locked = false
  try {
    const result = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock($1, $2) AS locked',
      args,
    )
    locked = result.rows[0]?.locked === true
    if (!locked) return busy()
    return await work()
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', args)
      } catch (error) {
        client.release(true)
        throw error
      }
    }
    client.release()
  }
}
