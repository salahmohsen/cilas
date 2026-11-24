import type { Payload } from 'payload'

import toSnakeCase from 'to-snake-case'

/** Holds the row lock of one row of any collection, as a writer does, until `release`. */
export const holdRow = async (payload: Payload, collection: string, id: number) => {
  const client = await payload.db.pool.connect()
  try {
    await client.query('begin')
    await client.query("set local lock_timeout = '2s'")
    const {
      rows: [holder],
    } = await client.query<{ pid: number }>('select pg_backend_pid() as pid')
    await client.query(
      `select id from "${toSnakeCase(collection)}" where id = $1 for no key update`,
      [id],
    )
    return {
      pid: holder.pid,
      async release() {
        try {
          await client.query('commit')
        } finally {
          client.release()
        }
      },
    }
  } catch (error) {
    client.release(true)
    throw error
  }
}

export const waitForLockWaiters = async (
  payload: Payload,
  holderPid: number,
  count: number,
  timeoutMs = 5000,
) => {
  const deadline = Date.now() + timeoutMs
  do {
    const {
      rows: [result],
    } = await payload.db.pool.query<{ waiting: number }>(
      `with recursive chain(pid) as (
        select $1::int
        union
        select a.pid from pg_stat_activity a
        join chain c on c.pid = any(pg_blocking_pids(a.pid))
      ) select (count(*) - 1)::int as waiting from chain`,
      [holderPid],
    )
    if (result.waiting >= count) return
    await new Promise((resolve) => setTimeout(resolve, 25))
  } while (Date.now() < deadline)
  throw new Error(`Expected ${count} row lock waiter(s) behind backend ${holderPid}`)
}
