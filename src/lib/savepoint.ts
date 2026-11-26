import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { sessionDb } from './row-lock'

let nextSavepoint = 0

/**
 * Runs one operation on `req`'s transaction so that its failure undoes only
 * itself: Payload rolls the whole transaction back when an operation on `req`
 * fails, also when the caller catches the error.
 *
 * For depth 0 only. A populating operation loads through the request's data
 * loader, which writes the `transactionID` from its cache key back on the outer
 * request, and the promise that `scoped` carries serialises to `{}`.
 */
export const withSavepoint = async <T>(
  req: PayloadRequest,
  write: (scoped: PayloadRequest) => Promise<T>,
): Promise<T> => {
  const transactionID = req.transactionID
  const db = await sessionDb(req)
  if (transactionID == null || !db) return write(req)

  // Payload's failure handler rolls back a concrete transaction ID. Its
  // promised-ID path joins the existing transaction without owning rollback.
  const scoped = {
    ...req,
    headers: req.headers,
    query: { ...req.query },
    url: req.url,
    transactionID: Promise.resolve(transactionID),
  }
  const name = sql.identifier(`sp_${++nextSavepoint}`)
  await db.execute(sql`savepoint ${name}`)
  try {
    try {
      return await write(scoped)
    } finally {
      if (req.transactionID !== transactionID) {
        req.transactionID = transactionID
        throw new Error('withSavepoint requires depth 0')
      }
    }
  } catch (error) {
    await db.execute(sql`rollback to savepoint ${name}`)
    throw error
  } finally {
    await db.execute(sql`release savepoint ${name}`)
  }
}
