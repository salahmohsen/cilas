import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { adminQueue } from '@/lib/review-queue'
import { STATUS_KEYS, waitsOn } from '@/lib/review-status'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../../testing/local-services.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { needsWorld, type NeedsWorld } from '../../../testing/needs.fixture'
import { createTracker } from '../../../testing/payload.fixture'
import { portalWorld } from '../../../testing/portal.fixture'
import { resendInbox } from '../../../testing/resend.test-utils'
import { groupOf } from '../lists/groups'
import { loadList } from '../lists/rows'

mockNetwork(resendInbox().handler, ...localServices)

let payload: Payload
const { track, cleanup } = createTracker()

describe('the admin set and the 1b admin list', () => {
  let world: NeedsWorld
  let admin: User

  const NEEDS_YOU = groupOf('submitted', 'admin', { hasSpace: false })

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const portal = await portalWorld(payload, track)
    world = await needsWorld(payload, track, portal)
    admin = (await payload.findByID({
      collection: 'users',
      id: portal.accounts.admin.id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as User
  }, 300_000)

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  const needsYouIds = async (collection: 'articles' | 'courses') => {
    const { groups } = await loadList(
      payload,
      admin,
      { collection, search: null, only: null, pages: { published: 20, closed: 20 } },
      'en',
    )
    return new Set(groups.find((group) => group.id === NEEDS_YOU)?.rows.map((row) => row.id))
  }

  it('the Needs you group holds exactly the keys that wait on the admin', () => {
    expect(
      STATUS_KEYS.every(
        (key) =>
          (groupOf(key, 'admin', { hasSpace: false }) === NEEDS_YOU) === (waitsOn(key) === 'admin'),
      ),
    ).toBe(true)
  })

  it('agree on every fixture article and course', async () => {
    const sets = await adminQueue(payload)
    for (const collection of ['articles', 'courses'] as const) {
      const listed = await needsYouIds(collection)
      for (const id of world.ids[collection])
        expect(listed.has(id), `${collection} ${id}`).toBe(sets[collection].has(id))
    }
  })

  it('a taken-down article resubmitted is in both', async () => {
    const id = world.notLive.takenDownResubmitted
    expect((await needsYouIds('articles')).has(id)).toBe(true)
    expect((await adminQueue(payload)).articles.has(id)).toBe(true)
  })

  it('a not-live article at changes_requested whose copy is submitted is in both', async () => {
    const id = world.notLive.changesRequestedCopySubmitted
    expect((await needsYouIds('articles')).has(id)).toBe(true)
    expect((await adminQueue(payload)).articles.has(id)).toBe(true)
  })

  it('a not-live article whose main row is at no list key and whose copy is submitted is in neither', async () => {
    const sets = await adminQueue(payload)
    const listed = await needsYouIds('articles')
    for (const id of [world.notLive.rejectedCopySubmitted, world.notLive.takenDownCopySubmitted]) {
      expect(listed.has(id), String(id)).toBe(false)
      expect(sets.articles.has(id), String(id)).toBe(false)
    }
  })
})
