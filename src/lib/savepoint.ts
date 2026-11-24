import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { sessionDb } from './lock-row'

let nextSavepoint = 0

export const withSavepoint = async <T>(
  req: PayloadRequest,
  write: () => Promise<T>,
): Promise<T> => {
  const db = await sessionDb(req)
  if (!db) return write()

  const name = sql.identifier(`sp_${++nextSavepoint}`)
  await db.execute(sql`savepoint ${name}`)
  try {
    return await write()
  } catch (error) {
    await db.execute(sql`rollback to savepoint ${name}`)
    throw error
  } finally {
    await db.execute(sql`release savepoint ${name}`)
  }
}
