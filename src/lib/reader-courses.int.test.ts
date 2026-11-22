import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readerCourseIds } from '@/lib/reader-courses'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker } from '../../testing/payload.fixture'
import { calendarWorld, type CalendarWorld } from '../../testing/portal-calendar.fixture'

let payload: Payload
const { track, cleanup } = createTracker()
let world: CalendarWorld

const userOf = (id: number) =>
  payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true }) as Promise<User>

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  world = await calendarWorld(payload, track)
})

afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('readerCourseIds', () => {
  it('gives a student their accepted enrollments', async () => {
    const ids = await readerCourseIds(payload, await userOf(world.accounts.student.id))
    expect(ids).toEqual(expect.arrayContaining([...world.portalCourses, world.communityCourse.id]))
    expect(ids).not.toContain(world.stranger.id)
    expect(ids).not.toContain(world.other.id)
  })

  it('gives a fellow the courses they teach, the draft included', async () => {
    const ids = await readerCourseIds(payload, await userOf(world.accounts.fellow.id))
    expect(ids).toEqual(expect.arrayContaining([...world.portalCourses, world.draft.id]))
    expect(ids).not.toContain(world.communityCourse.id)
    expect(ids).not.toContain(world.owner.id)
  })

  it('gives nothing for a pending enrollment', async () => {
    const ids = await readerCourseIds(payload, await userOf(world.accounts.student.id))
    expect(ids).not.toContain(world.pending.id)
  })

  it('gives nothing to an account with no person', async () => {
    const admin = await userOf(world.accounts.admin.id)
    expect(admin.person ?? null).toBeNull()
    expect(await readerCourseIds(payload, admin)).toEqual([])
  })
})
