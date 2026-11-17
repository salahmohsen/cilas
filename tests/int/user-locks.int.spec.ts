// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '../../src/payload.config'
import { createTracker } from './fixtures'

let payload: Payload
let course: number
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config })
  course = (await payload.find({ collection: 'courses', limit: 1, depth: 0, overrideAccess: true }))
    .docs[0].id
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
  // A lock left with no user makes the admin page of its document render
  // empty until the lock expires (Payload's getIsLocked reads `user.value`).
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
