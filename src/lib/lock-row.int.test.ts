import {
  commitTransaction,
  createLocalReq,
  getPayload,
  initTransaction,
  killTransaction,
  type Payload,
  type Where,
} from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, uniq, uniqEmail } from '../../testing/payload.fixture'
import { trustedWrites, writePublishedArticle } from '../../testing/portal-lists.fixture'
import { rest } from '../../testing/payload-rest.test-utils'
import { resendInbox } from '../../testing/resend.test-utils'
import { holdRow, waitForLockWaiters } from '../../testing/row-lock.test-utils'
import { lockRow } from './lock-row'
import { notify } from './notify'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
let author: User
let adminToken: string
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config })
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Row Lock Owner', slug: uniq('row-lock-owner') },
    }),
  )
  author = track(
    'users',
    await payload.create({
      collection: 'users',
      depth: 0,
      data: {
        email: uniqEmail('row-lock-owner'),
        password: crypto.randomUUID(),
        roles: ['member'],
        person: person.id,
      },
    }),
  )
  const email = uniqEmail('row-lock-admin')
  const password = crypto.randomUUID()
  track(
    'users',
    await payload.create({
      collection: 'users',
      depth: 0,
      data: { email, password, roles: ['admin'] },
    }),
  )
  const { token } = await payload.login({ collection: 'users', data: { email, password } })
  if (!token) throw new Error('The fixture admin did not receive a token')
  adminToken = token
})

afterAll(async () => {
  if (!payload) return
  await cleanup(payload)
  await payload.destroy()
})

const withHeldArticle = async (id: number, write: () => Promise<unknown>) => {
  const holder = await holdRow(payload, 'articles', id)
  const pending = write()
  void pending.catch(() => {})
  try {
    await waitForLockWaiters(payload, holder.pid, 1)
  } finally {
    await holder.release()
    await pending
  }
}

describe('review-events: lockRow', () => {
  it('a draft save on a live article waits for the row lock', async () => {
    const { create } = trustedWrites(payload, track)
    const id = await writePublishedArticle(create, Number(author.person), 'Live article')
    await withHeldArticle(id, () =>
      payload.update({
        collection: 'articles',
        id,
        user: author,
        overrideAccess: false,
        depth: 0,
        draft: true,
        data: { title: 'Draft article' },
      }),
    )
  })

  it('a restoreVersion waits for the row lock', async () => {
    const { create, edit } = trustedWrites(payload, track)
    const id = await writePublishedArticle(create, Number(author.person), 'Live article')
    await edit('articles', id, { title: 'An earlier draft' })
    const {
      docs: [version],
    } = await payload.findVersions({
      collection: 'articles',
      where: { parent: { equals: id }, latest: { equals: true } },
      limit: 1,
      depth: 0,
    })
    await withHeldArticle(id, async () => {
      const response = await rest('POST', `articles/versions/${version.id}?draft=true`, {
        token: adminToken,
      })
      expect(response.status).toBe(200)
    })
  })

  it('lockRow refuses outside a transaction', async () => {
    const req = await createLocalReq({}, payload)
    await expect(lockRow(req, 'articles', 1)).rejects.toMatchObject({ status: 500 })
  })
})

describe('review-events: savepoint', () => {
  it('a failed row does not abort the transaction', async () => {
    const req = await createLocalReq({}, payload)
    expect(await initTransaction(req)).toBe(true)
    const transactionID = req.transactionID
    try {
      const doc = await payload.create({
        collection: 'people',
        data: { name: 'Savepoint Marker', slug: uniq('savepoint-marker') },
        req,
      })
      track('people', doc)
      await notify(payload, [-1], { kind: 'submitted' }, req)
      const { docs } = await payload.find({
        collection: 'users',
        limit: 1,
        depth: 0,
        req,
      })
      expect(docs).toHaveLength(1)
      expect(req.transactionID).toBe(transactionID)
      await commitTransaction(req)
      const persisted = await payload.findByID({ collection: 'people', id: doc.id, depth: 0 })
      expect(persisted.id).toBe(doc.id)
    } finally {
      await killTransaction(req)
    }
  })

  it('a notification row rolls back with the transaction', async () => {
    const req = await createLocalReq({}, payload)
    const description = uniq('notification rolls back')
    const where: Where = {
      and: [{ recipient: { equals: author.id } }, { description: { equals: description } }],
    }
    expect(await initTransaction(req)).toBe(true)
    try {
      await notify(payload, [author.id], { kind: 'submitted', description }, req)
      const { docs } = await payload.find({
        collection: 'notifications',
        where,
        limit: 1,
        depth: 0,
        req,
      })
      expect(docs).toHaveLength(1)
      await killTransaction(req)
      const visible = await payload.find({ collection: 'notifications', where, limit: 1, depth: 0 })
      expect(visible.docs).toEqual([])
    } finally {
      await killTransaction(req)
      await payload.delete({ collection: 'notifications', where })
    }
  })
})
