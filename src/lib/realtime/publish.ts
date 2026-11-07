import { relId } from '@/lib/relation'
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'

import { sendPushForNotification } from '@/lib/push/send'

import {
  NOTIFICATION_CHANNEL,
  TAB_HEADER,
  type NotificationEvent,
  type StoredNotification,
} from './events'

// Postgres refuses a NOTIFY payload of 8000 bytes or more.
const MAX_PAYLOAD = 7800

const idOf = (value: unknown): number | undefined => {
  const id = relId(value)
  return typeof id === 'number' ? id : undefined
}

/**
 * The tab that made the request. A REST call carries the header on `req`; a
 * Local API call (src/lib/notify.ts) gets a fresh `req`, so this reads the
 * incoming request through Next. Outside a request (a job) there is none.
 */
const originOf = async (req: PayloadRequest): Promise<string | undefined> => {
  const own = req.headers?.get(TAB_HEADER)
  if (own) return own
  try {
    const { headers } = await import('next/headers')
    return (await headers()).get(TAB_HEADER) ?? undefined
  } catch {
    return undefined
  }
}

/**
 * Sends the event with `pg_notify` in the request's transaction: Postgres
 * delivers it to every listening instance on commit, and never on rollback.
 * A failed send is logged, never thrown: the bells refetch on reconnect.
 */
const publish = async (req: PayloadRequest, event: NotificationEvent) => {
  let payload = JSON.stringify(event)
  if (Buffer.byteLength(payload) > MAX_PAYLOAD) {
    payload = JSON.stringify({ ...event, doc: undefined })
  }
  const adapter = req.payload.db as unknown as PostgresAdapter
  const db =
    (req.transactionID && adapter.sessions?.[await req.transactionID]?.db) || adapter.drizzle
  try {
    await db.execute(sql`select pg_notify(${NOTIFICATION_CHANNEL}, ${payload})`)
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Live notification ${event.id} not sent` })
  }
}

/** A new row, or a change to when it was read. Other updates are not possible. */
export const publishChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation === 'update' && previousDoc?.read_at === doc.read_at) return doc
  const recipient = idOf(doc.recipient)
  if (recipient === undefined) return doc
  const row = doc as StoredNotification
  await publish(req, {
    op: operation === 'create' ? 'created' : 'updated',
    id: row.id,
    recipient,
    origin: await originOf(req),
    doc: {
      id: row.id,
      kind: row.kind,
      title: row.title,
      description: row.description,
      link: row.link,
      read_at: row.read_at,
      actor_name: row.actor_name,
      actor_photo: row.actor_photo,
      createdAt: row.createdAt,
    },
  })
  // Phones and other devices hear of it too. Not awaited: the write must not
  // wait for a push service, and a failed push is logged inside.
  if (operation === 'create') {
    void sendPushForNotification(req.payload, {
      id: row.id,
      recipient,
      kind: row.kind,
      description: row.description,
      link: row.link,
    })
  }
  return doc
}

export const publishDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const recipient = idOf(doc.recipient)
  if (recipient === undefined) return doc
  await publish(req, {
    op: 'deleted',
    id: doc.id as number,
    recipient,
    origin: await originOf(req),
  })
  return doc
}
