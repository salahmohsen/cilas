import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { spacesOff } from '@/lib/spaces'
import { mySpaces } from '@/lib/spaces-data'
import config from '@/payload.config'

import { createTracker, uniq } from './payload.fixture'
import { holdSpacesMode, LOCALES, portalWorld, ROLES, type PortalWorld } from './portal.fixture'

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

  it('room labels are the titles the space list shows, in each language', async () => {
    const student = await payload.findByID({
      collection: 'users',
      id: world.accounts.student.id,
      depth: 0,
      overrideAccess: true,
    })
    for (const locale of LOCALES) {
      const { communities, courses } = await mySpaces(payload, student, locale)
      const titleOf = (rows: typeof courses, space: number) =>
        rows.find((row) => row.space.id === space)?.title
      expect({ locale, label: world.course.label[locale] }).toEqual({
        locale,
        label: titleOf(courses, world.course.space),
      })
      expect({ locale, label: world.community.label[locale] }).toEqual({
        locale,
        label: titleOf(communities, world.community.space),
      })
    }
    expect(world.course.label.ar).not.toBe(world.course.label.en)
    expect(world.community.label.ar).not.toBe(world.community.label.en)
  })

  it('spacesOff is true only when the switch is off', async () => {
    const seen: Record<string, boolean> = {}
    for (const value of ['off', 'trial', 'on'] as const) {
      await mode.set(value)
      seen[value] = await spacesOff(payload)
    }
    await mode.set('on')
    expect(seen).toEqual({ off: true, trial: false, on: false })
  })
})
