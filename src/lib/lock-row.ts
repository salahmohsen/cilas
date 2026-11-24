import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { APIError, NotFound, type CollectionSlug, type PayloadRequest } from 'payload'

/** Postgres: `lock_not_available`, raised when `lock_timeout` runs out. */
const LOCK_NOT_AVAILABLE = '55P03'

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
 * Takes the row's lock for the rest of the transaction. Waits 5 seconds at
 * most; then the write is refused with a 409 (a busy row), not left to hold a
 * pool connection.
 */
export const lockRow = async (req: PayloadRequest, collection: CollectionSlug, id: number) => {
  const db = await sessionDb(req)
  const table = req.payload.db.tableNameMap.get(collection.replaceAll('-', '_'))
  if (!db || !table) throw new APIError('Could not lock the document. Try again.', 500)
  try {
    await db.execute(sql`set local lock_timeout = '5s'`)
    await db.execute(
      sql`select id from ${sql.identifier(table)} where id = ${id} for no key update`,
    )
  } catch (error) {
    if (timedOut(error)) throw new APIError('This document is busy. Try again.', 409)
    throw error
  }
  // The limit is for this wait only; later statements keep the session default.
  await db.execute(sql`set local lock_timeout = default`)
}
