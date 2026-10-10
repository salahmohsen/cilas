// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

type Tracked = 'people' | 'programmes' | 'memberships'

let payload: Payload
const created: Array<{ collection: Tracked; id: number }> = []

const track = <T extends { id: number }>(collection: Tracked, doc: T): T => {
  created.push({ collection, id: doc.id })
  return doc
}

describe('people and memberships', () => {
  let personId: number
  let programmeId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Membership Probe', slug: 'membership-probe' },
        overrideAccess: true,
      }),
    ).id
    programmeId = track(
      'programmes',
      await payload.create({
        collection: 'programmes',
        data: { kind: 'bridge', title: 'Probe Programme', slug: 'probe-programme' },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => undefined)
    }
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
