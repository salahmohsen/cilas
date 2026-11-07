// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { createTracker, uniq } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()

describe('people and memberships', () => {
  let personId: number
  let programmeId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Membership Probe', slug: uniq('membership-probe') },
        overrideAccess: true,
      }),
    ).id
    programmeId = track(
      'programmes',
      await payload.create({
        collection: 'programmes',
        data: { kind: 'bridge', title: 'Probe Programme', slug: uniq('probe-programme') },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('lists a membership on the person through the join', async () => {
    track(
      'memberships',
      await payload.create({
        collection: 'memberships',
        data: { person: personId, programme: programmeId, role: 'visiting_fellow' },
        overrideAccess: true,
      }),
    )

    const person = await payload.findByID({
      collection: 'people',
      id: personId,
      overrideAccess: true,
    })
    expect(person.memberships?.docs).toHaveLength(1)
  })

  it('refuses a second membership for the same person and programme', async () => {
    await expect(
      payload.create({
        collection: 'memberships',
        data: { person: personId, programme: programmeId, role: 'student' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
