import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import { APIError, type CollectionSlug, type PayloadRequest } from 'payload'

export const sessionDb = async (req: PayloadRequest) => {
  const id = await req.transactionID
  const adapter = req.payload.db as unknown as PostgresAdapter
  return id == null ? null : (adapter.sessions[id]?.db ?? null)
}

export const lockRow = async (req: PayloadRequest, collection: CollectionSlug, id: number) => {
  const db = await sessionDb(req)
  const table = req.payload.db.tableNameMap.get(collection.replaceAll('-', '_'))
  if (!db || !table) throw new APIError('Could not lock the document. Try again.', 500)
  await db.execute(sql`select id from ${sql.identifier(table)} where id = ${id} for no key update`)
}
