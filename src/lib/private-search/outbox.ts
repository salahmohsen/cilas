import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
  PayloadRequest,
} from 'payload'
import type { Kind } from './model'

const transactionOf = async (req: PayloadRequest) => {
  const transactionID = await req.transactionID
  // Refuse a nontransactional mutation rather than lose its indexing event.
  const transaction =
    transactionID && (req.payload.db as unknown as PostgresAdapter).sessions[transactionID]?.db
  if (!transaction) throw new Error('Private indexing requires a database transaction')
  return transaction
}

export const enqueue = async (req: PayloadRequest, kind: Kind | 'thread', id: number) => {
  const transaction = await transactionOf(req)
  await transaction.execute(
    sql`INSERT INTO spaces_search_outbox (kind, source_id) VALUES (${kind}, ${id})`,
  )
}
export const searchChanged =
  (kind: Kind): CollectionAfterChangeHook =>
  async ({ req, doc, previousDoc }) => {
    const scope = kind === 'post' && previousDoc?.deleted_at && !doc.deleted_at ? 'thread' : kind
    await enqueue(req, scope, doc.id)
    return doc
  }
export const searchDeleted =
  (kind: Kind): CollectionAfterDeleteHook =>
  async ({ req, id }) => {
    await enqueue(req, kind, Number(id))
  }

export const searchDeletingComment: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const transaction = await transactionOf(req)
  // Postgres nulls child relationships without running Payload child hooks.
  await transaction.execute(sql`INSERT INTO spaces_search_outbox (kind, source_id)
    SELECT 'comment', id FROM space_comments WHERE parent_id = ${Number(id)}`)
}
