import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from './payload.config'
import { createTracker, uniq } from '../testing/payload.fixture'

let payload: Payload
let course: number
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config })
  course = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: { title: 'Lock probe', slug: uniq('lock-probe'), course_type: 'THEMATIC' },
      draft: true,
      overrideAccess: true,
    }),
  ).id
})

afterAll(async () => {
  await cleanup(payload)
})

const user = async (name: string) => {
  const email = `lock-${name}-${crypto.randomUUID()}@cilas.test`
  return track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password: 'test', roles: ['member'] },
      overrideAccess: true,
    }),
  )
}

const lockOf = (id: number) =>
  payload.create({
    collection: 'payload-locked-documents',
    data: {
      document: { relationTo: 'courses', value: course },
      user: { relationTo: 'users', value: id },
    },
    overrideAccess: true,
  })

const locksOn = async (id: number) =>
  (
    await payload.find({
      collection: 'payload-locked-documents',
      where: { id: { equals: id } },
      depth: 0,
      overrideAccess: true,
    })
  ).totalDocs

describe('locks of a deleted user', () => {
  it('go with the user, and the locks of others stay', async () => {
    const leaver = await user('leaver')
    const stayer = await user('stayer')
    const gone = await lockOf(leaver.id)
    const kept = await lockOf(stayer.id)

    await payload.delete({ collection: 'users', id: leaver.id, overrideAccess: true })

    expect(await locksOn(gone.id)).toBe(0)
    expect(await locksOn(kept.id)).toBe(1)
    await payload.delete({
      collection: 'payload-locked-documents',
      id: kept.id,
      overrideAccess: true,
    })
  })
})

describe('who may write a lock', () => {
  const as = (account: { id: number }) => ({
    user: { ...account, collection: 'users' } as never,
    overrideAccess: false,
  })

  it('a member deletes their own lock, not another account’s', async () => {
    const holder = await user('holder')
    const other = await user('other')
    const lock = await lockOf(holder.id)

    await expect(
      payload.delete({ collection: 'payload-locked-documents', id: lock.id, ...as(other) }),
    ).rejects.toThrow()
    expect(await locksOn(lock.id)).toBe(1)

    await payload.delete({ collection: 'payload-locked-documents', id: lock.id, ...as(holder) })
    expect(await locksOn(lock.id)).toBe(0)
  })

  it('a member writes a lock only in their own name, taking over included', async () => {
    const holder = await user('first')
    const taker = await user('taker')
    const doc = { relationTo: 'courses' as const, value: course }

    await expect(
      payload.create({
        collection: 'payload-locked-documents',
        data: { document: doc, user: { relationTo: 'users', value: holder.id } },
        ...as(taker),
      }),
    ).rejects.toThrow()

    const lock = await lockOf(holder.id)
    await expect(
      payload.update({
        collection: 'payload-locked-documents',
        id: lock.id,
        data: { user: { relationTo: 'users', value: holder.id } },
        ...as(taker),
      }),
    ).rejects.toThrow()

    const taken = await payload.update({
      collection: 'payload-locked-documents',
      id: lock.id,
      data: { user: { relationTo: 'users', value: taker.id } },
      depth: 0,
      ...as(taker),
    })
    expect(taken.user).toMatchObject({ relationTo: 'users', value: taker.id })
    await payload.delete({ collection: 'payload-locked-documents', id: lock.id, ...as(taker) })
  })
})
