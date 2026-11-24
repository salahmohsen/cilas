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
import { lockRow, requireRowLock } from './row-lock'
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

const withHeld = async (collection: string, id: number, write: () => Promise<unknown>) => {
  const holder = await holdRow(payload, collection, id)
  const pending = write()
  void pending.catch(() => {})
  try {
    await waitForLockWaiters(payload, holder.pid, 1)
  } finally {
    await holder.release()
    await pending
  }
}

const withHeldArticle = (id: number, write: () => Promise<unknown>) =>
  withHeld('articles', id, write)

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

  it('a waiter that waits too long is refused with a 409, not left to queue', async () => {
    const { create } = trustedWrites(payload, track)
    const id = await writePublishedArticle(create, Number(author.person), 'Live article')
    const holder = await holdRow(payload, 'articles', id)
    try {
      await expect(
        payload.update({
          collection: 'articles',
          id,
          user: author,
          overrideAccess: false,
          depth: 0,
          draft: true,
          data: { title: 'Draft article' },
        }),
      ).rejects.toMatchObject({ status: 409 })
    } finally {
      await holder.release()
    }
    await payload.update({
      collection: 'articles',
      id,
      user: author,
      overrideAccess: false,
      depth: 0,
      draft: true,
      data: { title: 'Draft article, again' },
    })
  })

  it('a course write waits for the row lock, then goes through', async () => {
    const id = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Locked course',
          slug: uniq('row-lock-course'),
          course_type: 'THEMATIC',
          tier: 'owner',
        },
        draft: true,
      }),
    ).id
    await withHeld('courses', id, () =>
      payload.update({
        collection: 'courses',
        id,
        data: { title: 'Locked course, edited' },
        draft: true,
        depth: 0,
      }),
    )
    const { title } = await payload.findByID({ collection: 'courses', id, draft: true, depth: 0 })
    expect(title).toBe('Locked course, edited')
  })

  it('a course write that waits too long is refused with a 409', async () => {
    const id = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Busy course',
          slug: uniq('row-lock-busy'),
          course_type: 'THEMATIC',
          tier: 'owner',
        },
        draft: true,
      }),
    ).id
    const holder = await holdRow(payload, 'courses', id)
    try {
      await expect(
        payload.update({
          collection: 'courses',
          id,
          data: { title: 'Busy course, edited' },
          draft: true,
          depth: 0,
        }),
      ).rejects.toMatchObject({ status: 409 })
    } finally {
      await holder.release()
    }
  })

  it('an anonymous write is refused without queueing on the row lock', async () => {
    const { create } = trustedWrites(payload, track)
    const id = await writePublishedArticle(create, Number(author.person), 'Live article')
    const holder = await holdRow(payload, 'articles', id)
    try {
      const body = new FormData()
      body.set('_payload', JSON.stringify({ title: 'Anonymous' }))
      const started = Date.now()
      const response = await rest('PATCH', `articles/${id}?draft=true`, { body })
      expect([401, 403]).toContain(response.status)
      expect(Date.now() - started).toBeLessThan(3000)
    } finally {
      await holder.release()
    }
  })

  it.each([
    ['PATCH', 'articles/abc'],
    ['POST', 'articles/versions/abc?draft=true'],
  ] as const)('%s with a non-numeric id is a 404, not a 500', async (method, path) => {
    const body = new FormData()
    body.set('_payload', JSON.stringify({ title: 'Nope' }))
    const response = await rest(method, path, { token: adminToken, body })
    expect(response.status).toBe(404)
  })

  it('lockRow locks nothing outside a transaction and says so', async () => {
    const req = await createLocalReq({}, payload)
    await expect(lockRow(req, 'articles', 1)).resolves.toBe(false)
  })

  it('requireRowLock refuses outside a transaction', async () => {
    const req = await createLocalReq({}, payload)
    await expect(requireRowLock(req, 'articles', 1)).rejects.toMatchObject({ status: 500 })
  })

  it('lockRow in a transaction returns true, also a second time on the same row', async () => {
    const { create } = trustedWrites(payload, track)
    const id = await writePublishedArticle(create, Number(author.person), 'Live article')
    const req = await createLocalReq({}, payload)
    expect(await initTransaction(req)).toBe(true)
    try {
      await expect(lockRow(req, 'articles', id)).resolves.toBe(true)
      await expect(lockRow(req, 'articles', id)).resolves.toBe(true)
    } finally {
      await killTransaction(req)
    }
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
