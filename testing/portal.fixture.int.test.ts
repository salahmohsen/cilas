import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { spacesOff } from '@/lib/spaces'
import { mySpaces } from '@/lib/spaces-data'
import config from '@/payload.config'

import { createTracker, uniq } from './payload.fixture'
import {
  EXPECTED_UNREAD,
  holdSpacesMode,
  LOCALES,
  portalWorld,
  ROLES,
  type PortalWorld,
} from './portal.fixture'

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

  const userOf = (id: number) =>
    payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true })

  const countsOf = async (id: number) => {
    const { communities, courses } = await mySpaces(payload, await userOf(id), 'en')
    const unread = (rows: typeof courses, space: number) =>
      rows.find((row) => row.space.id === space)?.unread
    return {
      course: unread(courses, world.course.space),
      otherCourse: unread(courses, world.otherCourse.space),
      community: unread(communities, world.community.space),
    }
  }

  it('every role reads the three rooms with the expected counts', async () => {
    await world.resetVisits()
    for (const role of ROLES)
      expect({ role, ...(await countsOf(world.accounts[role].id)) }).toEqual({
        role,
        ...EXPECTED_UNREAD,
      })
    const student = world.accounts.student
    track(
      'space-visits',
      await payload.create({
        collection: 'space-visits',
        data: {
          account: student.id,
          space: world.course.space,
          last_visited_at: new Date().toISOString(),
        },
        overrideAccess: true,
      }),
    )
    expect((await countsOf(student.id)).course).toBe(0)
    await world.resetVisits()
    expect(await countsOf(student.id)).toEqual(EXPECTED_UNREAD)
    const post = await payload.findByID({
      collection: 'space-posts',
      id: world.course.post,
      depth: 0,
      user: await userOf(student.id),
      overrideAccess: false,
    })
    expect(post.id).toBe(world.course.post)
  })

  it('a loner reads no space while spaces are trial with the community closed', async () => {
    try {
      await mode.set('trial', { trialCommunity: false })
      for (const loner of Object.values(world.loners)) {
        const spaces = await mySpaces(payload, await userOf(loner.id), 'en')
        expect({ email: loner.email, ...spaces }).toEqual({
          email: loner.email,
          communities: [],
          cohorts: [],
          courses: [],
        })
      }
    } finally {
      await mode.set('on')
    }
  })

  it('the other course has a 60-character Arabic title with no space', () => {
    expect(world.otherCourse.label.ar).toHaveLength(60)
    expect(world.otherCourse.label.ar).toMatch(/^[\u0600-\u06ff]+$/)
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
