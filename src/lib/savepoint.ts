import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { sessionDb } from './row-lock'

let nextSavepoint = 0

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
    return await write(scoped)
  } catch (error) {
    await db.execute(sql`rollback to savepoint ${name}`)
    throw error
  } finally {
    await db.execute(sql`release savepoint ${name}`)
  }
}
