import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { notify } from '@/lib/notify'
import config from '@/payload.config'

import { createTracker, uniqEmail } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()

let account: number

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  account = track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email: uniqEmail('notify'), password: crypto.randomUUID(), roles: ['fellow'] },
      overrideAccess: true,
    }),
  ).id
})

afterAll(() => cleanup(payload))

describe('notify', () => {
  it('leaves one notification per account, and a failure never throws', async () => {
    const missing = 2_147_000_000
    const logged = vi.spyOn(payload.logger, 'error')
    await notify(payload, [account, account, missing], {
      kind: 'submitted',
      description: 'A course waits for review: “Test”',
      link: '/admin/x',
    })
    const { docs } = await payload.find({
      collection: 'notifications',
      where: { recipient: { equals: account } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      kind: 'submitted',
      title: 'Review requested',
      description: 'A course waits for review: “Test”',
      link: '/admin/x',
    })
    expect(logged).toHaveBeenCalledTimes(1)
    logged.mockRestore()
  })
})

describe('peoplePagesOf', () => {
  it('keeps every page on unless an admin turned it off', async () => {
    const { livePeoplePages, peoplePagesOf } = await import('@/lib/people-pages')
    const on = peoplePagesOf({ governance: false, fellows: null })
    expect(on).toEqual({ fellows: true, cilasians: true, governance: false })
    expect(livePeoplePages(on).map((p) => p.key)).toEqual(['fellows', 'cilasians'])
  })
})
