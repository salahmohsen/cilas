// @vitest-environment node
import pg from 'pg'
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { NOTIFICATION_CHANNEL, type NotificationEvent } from '@/lib/realtime/events'

import { uniqEmail } from './fixtures'

let payload: Payload
let listener: pg.Client
let recipient: number
const heard: NotificationEvent[] = []
const made: number[] = []
let account: number

const settle = () => new Promise((resolve) => setTimeout(resolve, 400))

const create = (data: { title: string; description?: string }, req?: unknown) =>
  payload.create({
    collection: 'notifications',
    data: { recipient, kind: 'comment', ...data },
    overrideAccess: true,
    ...(req ? { req: req as never } : {}),
  })

describe('live notification publishing', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    recipient = account = (
      await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail('realtime-recipient'),
          password: crypto.randomUUID(),
          roles: ['member'],
        },
        overrideAccess: true,
      })
    ).id
    listener = new pg.Client({ connectionString: process.env.DATABASE_URL })
    await listener.connect()
    // The channel is shared by every spec running against this database;
    // only this test's own recipient counts.
    listener.on('notification', (msg) => {
      const event = JSON.parse(msg.payload!) as NotificationEvent
      if (event.recipient === recipient) heard.push(event)
    })
    await listener.query(`LISTEN ${NOTIFICATION_CHANNEL}`)
  })

  afterAll(async () => {
    for (const id of made) {
      await payload
        .delete({ collection: 'notifications', id, overrideAccess: true })
        .catch(() => {})
    }
    await payload.delete({ collection: 'users', id: account, overrideAccess: true }).catch(() => {})
    await listener?.end()
  })

  it('sends nothing when the save rolls back, and the event on commit', async () => {
    const transactionID = await payload.db.beginTransaction()
    if (!transactionID) throw new Error('Needs a database transaction')
    const req = await createLocalReq({}, payload)
    req.transactionID = transactionID
    await create({ title: 'rolled back' }, req)
    await settle()
    expect(heard).toHaveLength(0)
    await payload.db.rollbackTransaction(transactionID)
    await settle()
    expect(heard).toHaveLength(0)

    const committed = await create({ title: 'committed' })
    made.push(committed.id)
    await settle()
    expect(heard).toHaveLength(1)
    expect(heard[0]).toMatchObject({
      op: 'created',
      id: committed.id,
      recipient,
      doc: { id: committed.id, title: 'committed' },
    })
  })

  it('sends a change of read_at, not other updates', async () => {
    heard.length = 0
    const row = await create({ title: 'to read' })
    made.push(row.id)
    await settle()
    heard.length = 0
    const readAt = new Date().toISOString()
    await payload.update({
      collection: 'notifications',
      id: row.id,
      data: { read_at: readAt },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'notifications',
      id: row.id,
      data: { read_at: readAt },
      overrideAccess: true,
    })
    await settle()
    expect(heard).toHaveLength(1)
    expect(heard[0]).toMatchObject({ op: 'updated', id: row.id, recipient })
  })

  it('leaves the row out of an event that would pass the NOTIFY limit', async () => {
    heard.length = 0
    const big = await create({ title: 'big', description: 'x'.repeat(9_000) })
    made.push(big.id)
    await settle()
    expect(heard).toHaveLength(1)
    expect(heard[0].doc).toBeUndefined()
    expect(heard[0]).toMatchObject({ op: 'created', id: big.id, recipient })
  })

  it('sends a delete without a row', async () => {
    heard.length = 0
    const row = await create({ title: 'to delete' })
    await settle()
    heard.length = 0
    await payload.delete({ collection: 'notifications', id: row.id, overrideAccess: true })
    await settle()
    expect(heard).toEqual([{ op: 'deleted', id: row.id, recipient }])
  })
})
