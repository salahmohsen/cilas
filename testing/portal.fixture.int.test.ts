import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mySpaces } from '@/lib/spaces-data'
import config from '@/payload.config'

import { createTracker, uniq } from './payload.fixture'
import { holdSpacesMode, portalWorld, ROLES, type PortalWorld } from './portal.fixture'

const { track, cleanup } = createTracker()
let payload: Payload
let world: PortalWorld
let mode: Awaited<ReturnType<typeof holdSpacesMode>>

describe('portal world', () => {
  beforeAll(async () => {
    payload = await getPayload({ config, key: uniq('portal-fixture') })
    mode = await holdSpacesMode(payload)
    await mode.set('on')
    world = await portalWorld(payload, track)
  }, 300_000)

  afterAll(async () => {
    try {
      await cleanup(payload)
    } finally {
      await mode.release()
    }
  }, 300_000)

  it('every role reads both rooms', async () => {
    for (const role of ROLES) {
      const user = await payload.findByID({
        collection: 'users',
        id: world.accounts[role].id,
        depth: 0,
        overrideAccess: true,
      })
      const { communities, courses } = await mySpaces(payload, user, 'en')
      const unread = (rows: typeof courses, space: number) =>
        rows.find((row) => row.space.id === space)?.unread
      expect({ role, course: unread(courses, world.course.space) }).toEqual({ role, course: 1 })
      expect({ role, community: unread(communities, world.community.space) }).toEqual({
        role,
        community: 1,
      })
    }
    const student = await payload.findByID({
      collection: 'users',
      id: world.accounts.student.id,
      depth: 0,
      overrideAccess: true,
    })
    const post = await payload.findByID({
      collection: 'space-posts',
      id: world.course.post,
      depth: 0,
      user: student,
      overrideAccess: false,
    })
    expect(post.id).toBe(world.course.post)
  })
})
