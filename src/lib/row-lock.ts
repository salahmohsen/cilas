import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import toSnakeCase from 'to-snake-case'

/**
 * Lock one row of a collection until the request's transaction ends, so
 * concurrent writers to it run one after the other. Returns false, and locks
 * nothing, when the request has no transaction: the caller decides whether to
 * go on without the guarantee. A collection the adapter has no table for is a
 * programming error and throws.
 */
export const lockRow = async (
  req: PayloadRequest,
  collection: string,
  id: number | string,
): Promise<boolean> => {
  const adapter = req.payload.db as unknown as PostgresAdapter
  const tableName = adapter.tableNameMap.get(toSnakeCase(collection))
  const table = tableName && adapter.tables[tableName]
  if (!table) throw new Error(`No table for collection "${collection}"`)

  const transactionID = await req.transactionID
  const transaction = transactionID && adapter.sessions[transactionID]?.db
  if (!transaction) return false

  await transaction.execute(
    sql`SELECT ${table.id} FROM ${table} WHERE ${table.id} = ${id} FOR UPDATE`,
  )
  return true
}
