import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { APIError, NotFound, type PayloadRequest } from 'payload'
import toSnakeCase from 'to-snake-case'

/** Postgres: `lock_not_available`, raised when `lock_timeout` runs out. */
const LOCK_NOT_AVAILABLE = '55P03'

/** The drizzle handle of the request's transaction, or null when it has none. */
export const sessionDb = async (req: PayloadRequest) => {
  const id = await req.transactionID
  const adapter = req.payload.db as unknown as PostgresAdapter
  return id == null ? null : (adapter.sessions[id]?.db ?? null)
}

/** The row id of a request's `id`, or a 404 for one no row can have. */
export const rowIdOf = (raw: unknown): number => {
  if (
    typeof raw === 'number'
      ? Number.isSafeInteger(raw) && raw > 0
      : /^[1-9]\d{0,14}$/.test(String(raw))
  ) {
    return Number(raw)
  }
  throw new NotFound()
}

const timedOut = (error: unknown): boolean => {
  const { code, cause } = (error ?? {}) as { code?: unknown; cause?: unknown }
  return code === LOCK_NOT_AVAILABLE || (cause != null && timedOut(cause))
}

/**
 * Lock one row of a collection until the request's transaction ends, so
 * concurrent writers to it run one after the other. Waits 5 seconds at most;
 * then the write is refused with a 409 (a busy row), not left to hold a pool
 * connection. Returns false, and locks nothing, when the request has no
 * transaction: the caller decides whether to go on without the guarantee (see
 * `requireRowLock` for a caller that cannot). A collection the adapter has no
 * table for is a programming error and throws.
 *
 * The default mode, `writers`, is `for no key update`: it conflicts with
 * itself, with `for update` and with an ordinary row update, so writers wait
 * for each other. It does not conflict with `for key share`, which every
 * insert of a row that references this one (a version row, for example) takes
 * through its foreign key. The `references` mode is `for update`: it also
 * holds back those inserts, for a delete that must see every row that points
 * at this one before it decides.
 */
export const lockRow = async (
  req: PayloadRequest,
  collection: string,
  id: number | string,
  mode: 'writers' | 'references' = 'writers',
): Promise<boolean> => {
  const adapter = req.payload.db as unknown as PostgresAdapter
  const tableName = adapter.tableNameMap.get(toSnakeCase(collection))
  const table = tableName && adapter.tables[tableName]
  if (!table) throw new Error(`No table for collection "${collection}"`)

  const db = await sessionDb(req)
  if (!db) return false

  try {
    await db.execute(sql`set local lock_timeout = '5s'`)
    await db.execute(
      mode === 'references'
        ? sql`SELECT ${table.id} FROM ${table} WHERE ${table.id} = ${id} FOR UPDATE`
        : sql`SELECT ${table.id} FROM ${table} WHERE ${table.id} = ${id} FOR NO KEY UPDATE`,
    )
  } catch (error) {
    if (timedOut(error)) throw new APIError('This document is busy. Try again.', 409)
    throw error
  }
  // The limit is for this wait only; later statements keep the session default.
  await db.execute(sql`set local lock_timeout = default`)
  return true
}

/** `lockRow` for a write that must not go on unserialized: no transaction is a 500. */
export const requireRowLock = async (
  req: PayloadRequest,
  collection: string,
  id: number | string,
  mode: 'writers' | 'references' = 'writers',
): Promise<void> => {
  if (!(await lockRow(req, collection, id, mode))) {
    throw new APIError('Could not lock the document. Try again.', 500)
  }
}
