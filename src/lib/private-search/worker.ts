import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import type { Client } from 'typesense'
import { activeGeneration, RecoveryRequired } from './generation'
import { ALIAS, projection, numericId, schema, type Kind, type Source } from './model'

type Event = { id: string; kind: Kind | 'thread'; source_id: number; attempts: number }
export const WRITER_LOCK = 192834711
type WriterLease = {
  check: () => Promise<void>
  publish: (generation: string) => Promise<void>
  uncertain: () => void
}
const withWriter = async <T>(
  payload: Payload,
  work: (lease: WriterLease) => Promise<T>,
  recovery = false,
): Promise<T | null> => {
  const connection = await payload.db.pool.connect()
  let lost = false
  let uncertain = false
  const token = randomUUID()
  const failed = () => {
    lost = true
  }
  connection.on('error', failed)
  let locked = false
  try {
    const result = await connection.query('SELECT pg_try_advisory_lock($1) AS locked', [
      WRITER_LOCK,
    ])
    locked = Boolean(result.rows[0].locked)
    if (!locked) return null
    const state = await connection.query(
      'SELECT writer_token FROM spaces_search_state WHERE id = 1',
    )
    if (state.rows[0]?.writer_token && !recovery) throw new RecoveryRequired()
    await connection.query('UPDATE spaces_search_state SET writer_token = $1 WHERE id = 1', [token])
    const check = async () => {
      if (lost) throw new RecoveryRequired()
      const owner = await connection.query(
        'SELECT writer_token FROM spaces_search_state WHERE id = 1',
      )
      if (lost || owner.rows[0]?.writer_token !== token) throw new RecoveryRequired()
    }
    const publish = async (generation: string) => {
      await check()
      const updated = await connection.query(
        'UPDATE spaces_search_state SET generation = $1 WHERE id = 1 AND writer_token = $2',
        [generation, token],
      )
      if (updated.rowCount !== 1) throw new RecoveryRequired()
    }
    const value = await work({
      check,
      publish,
      uncertain: () => {
        uncertain = true
      },
    })
    await check()
    if (!uncertain)
      await connection.query(
        'UPDATE spaces_search_state SET writer_token = NULL WHERE id = 1 AND writer_token = $1',
        [token],
      )
    return value
  } finally {
    try {
      if (locked && !lost) await connection.query('SELECT pg_advisory_unlock($1)', [WRITER_LOCK])
    } finally {
      connection.removeListener('error', failed)
      connection.release(lost)
    }
  }
}
const sources = async (payload: Payload, kind: Kind, id: number) => {
  const { docs } = await payload.find({
    collection: kind === 'post' ? 'space-posts' : 'space-comments',
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] as Source | undefined
}
type LeaseCheck = () => Promise<void>
const erase = async (client: Client, collection: string, filter: string, check: LeaseCheck) => {
  await check()
  await client.collections(collection).documents().delete({ filter_by: filter })
  await check()
}
const upsert = async (
  client: Client,
  collection: string,
  kind: Kind,
  sources: Source[],
  check: LeaseCheck,
) => {
  const documents = sources.flatMap((source) => projection(kind, source) ?? [])
  if (documents.length) {
    // Array import throws on ANY failed row in SDK 3.1.1. Never log ImportError, which includes content.
    await check()
    await client
      .collections(collection)
      .documents()
      .import(documents, { action: 'upsert', throwOnFail: true })
    await check()
  }
}
const refresh = async (
  payload: Payload,
  client: Client,
  collection: string,
  event: Pick<Event, 'kind' | 'source_id'>,
  check: LeaseCheck = async () => {},
) => {
  const { kind, source_id: id } = event
  const source = await sources(payload, kind === 'thread' ? 'post' : kind, id)
  if (kind === 'comment') {
    await erase(client, collection, `kind:=comment && sourceId:=${id}`, check)
    if (!source || source.deleted_at) return
    const parentId = numericId(source.post)
    const parent = parentId ? await sources(payload, 'post', parentId) : null
    if (parent && !parent.deleted_at && numericId(parent.space) === numericId(source.space)) {
      await upsert(client, collection, kind, [source], check)
    }
    return
  }
  // Deleting a post removes its descendants even when Payload kept a tombstone or nulled relations.
  if (!source || source.deleted_at) {
    await erase(client, collection, `postId:=${id}`, check)
    return
  }
  await upsert(client, collection, 'post', [source], check)
  if (kind !== 'thread') return
  for (let after = 0; ;) {
    const { docs } = await payload.find({
      collection: 'space-comments',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      sort: 'id',
      where: {
        and: [
          { post: { equals: id } },
          { space: { equals: numericId(source.space) } },
          { id: { greater_than: after } },
          { deleted_at: { exists: false } },
        ],
      },
    })
    await upsert(client, collection, 'comment', docs, check)
    if (docs.length < 100) break
    after = docs.at(-1)!.id
  }
}
export const processOutbox = async (payload: Payload, client: Client, limit = 100) =>
  withWriter(payload, async ({ check, uncertain }) => {
    const generation = await activeGeneration(payload)
    const { rows } = await payload.db.pool.query<Event>(
      'SELECT id, kind, source_id, attempts FROM spaces_search_outbox WHERE available_at <= now() ORDER BY id LIMIT $1',
      [Math.min(100, Math.max(1, limit))],
    )
    let processed = 0
    let failed = 0
    let recoveryRequired = false
    for (const event of rows) {
      try {
        await refresh(payload, client, generation, event, check)
        await payload.db.pool.query('DELETE FROM spaces_search_outbox WHERE id = $1', [event.id])
        processed++
      } catch (error) {
        await check()
        // A transport failure can leave a write in flight at Typesense. Fence it
        // into this generation and require a unique-generation recovery rebuild.
        const definite =
          error &&
          typeof error === 'object' &&
          (('name' in error && error.name === 'ImportError') ||
            ('httpStatus' in error &&
              typeof error.httpStatus === 'number' &&
              error.httpStatus >= 400 &&
              error.httpStatus < 500))
        if (!definite) {
          uncertain()
          recoveryRequired = true
        }
        await payload.db.pool.query(
          `UPDATE spaces_search_outbox SET attempts = attempts + 1,
        available_at = now() + make_interval(secs => $2) WHERE id = $1`,
          [event.id, Math.min(3600, 2 ** Math.min(12, event.attempts + 1))],
        )
        failed++
        if (recoveryRequired) break
      }
    }
    // Bounded maintenance; keys contain user IDs and hashed network identifiers, never queries.
    await payload.db.pool.query(
      "DELETE FROM spaces_search_rate WHERE window_start < now() - interval '2 minutes'",
    )
    return { processed, failed, recoveryRequired }
  })

export const rebuild = async (payload: Payload, client: Client) =>
  withWriter(
    payload,
    async ({ check, publish }) => {
      const generation = `${ALIAS}_${randomUUID().replaceAll('-', '')}`
      await check()
      await client.collections().create(schema(generation))
      await check()
      let swapAttempted = false
      try {
        for (let after = 0; ;) {
          const { docs } = await payload.find({
            collection: 'space-posts',
            overrideAccess: true,
            depth: 0,
            limit: 100,
            sort: 'id',
            where: { id: { greater_than: after } },
          })
          for (const post of docs)
            await refresh(
              payload,
              client,
              generation,
              { kind: 'thread', source_id: post.id },
              check,
            )
          if (docs.length < 100) break
          after = docs.at(-1)!.id
        }
        // Capture actual committed rows, never a sequence watermark: earlier IDs can commit later.
        // Keep them durable until after alias swap. A crash can only cause idempotent replays.
        const { rows } = await payload.db.pool.query<Event>(
          'SELECT id, kind, source_id, attempts FROM spaces_search_outbox ORDER BY id LIMIT 10001',
        )
        if (rows.length > 10000) throw new Error('Rebuild backlog budget exceeded')
        for (const event of rows) await refresh(payload, client, generation, event, check)
        await check()
        swapAttempted = true
        await client.aliases().upsert(ALIAS, { collection_name: generation })
        await publish(generation)
        if (rows.length)
          await payload.db.pool.query(
            'DELETE FROM spaces_search_outbox WHERE id = ANY($1::bigint[])',
            [rows.map((r) => r.id)],
          )
        return { generation, replayed: rows.length }
      } finally {
        if (!swapAttempted) {
          // A failed import may contain private text. Expose no engine error or document details.
          try {
            await client.collections(generation).delete()
          } catch {
            /* Retention requires operator cleanup if engine is down. */
          }
        }
      }
    },
    true,
  )

export const pruneGenerations = async (payload: Payload, client: Client) =>
  withWriter(payload, async ({ check }) => {
    const current = await activeGeneration(payload)
    const collections = await client.collections().retrieve()
    let removed = 0
    for (const collection of collections) {
      if (collection.name === current || !/^spaces_search_[a-f0-9]{32}$/.test(collection.name))
        continue
      await check()
      await client.collections(collection.name).delete()
      removed++
    }
    return { removed }
  })
