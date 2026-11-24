import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readerCourseIds } from '@/lib/reader-courses'
import config from '@/payload.config'
import type { Enrollment, User } from '@/payload-types'
import { nextSession } from '@/portal/home/next-session'

import { createTracker } from '../../testing/payload.fixture'
import { calendarWorld, type CalendarWorld } from '../../testing/portal-calendar.fixture'

let payload: Payload
const { track, cleanup } = createTracker()
let world: CalendarWorld

const sorted = (ids: number[]) => ids.toSorted((a, b) => a - b)

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

  it('counts every enrollment that made it into the course, and no other', async () => {
    const { student } = world.loners
    const enroll = async (course: number, status: Enrollment['status']) =>
      track(
        'enrollments',
        await payload.create({
          collection: 'enrollments',
          data: { person: student.person!, course, status, source: 'admin' },
          overrideAccess: true,
        }),
      )
    await enroll(world.stranger.id, 'confirmed')
    await enroll(world.communityCourse.id, 'completed')
    await enroll(world.pending.id, 'applied')
    await enroll(world.other.id, 'withdrawn')
    await enroll(world.owner.id, 'rejected')
    const ids = await readerCourseIds(payload, await userOf(student.id))
    expect(sorted(ids)).toEqual(sorted([world.stranger.id, world.communityCourse.id]))
  })

  it('gives nothing to an account with no person', async () => {
    const admin = await userOf(world.accounts.admin.id)
    expect(admin.person ?? null).toBeNull()
    expect(await readerCourseIds(payload, admin)).toEqual([])
  })
})

describe('nextSession', () => {
  it('skips earlier cancelled and past meetings across the reader’s courses', async () => {
    for (const [date, cancelled] of [
      ['2000-01-01', false],
      ['2034-10-01', true],
    ] as const) {
      track(
        'sessions',
        await payload.create({
          collection: 'sessions',
          data: {
            course: world.communityCourse.id,
            title: 'Earlier session',
            cancelled,
            meetings: [{ date, start_time: '09:00', end_time: '10:00' }],
          },
          overrideAccess: true,
        }),
      )
    }
    const user = await userOf(world.accounts.student.id)
    const meeting = await nextSession(payload, user, 'en')
    expect(meeting).toMatchObject({ date: '2034-10-05' })
    expect(meeting?.href).toMatch(/^\/en\/(spaces\/course|study)\//)
  })

  it('returns null without a course', async () => {
    expect(await nextSession(payload, await userOf(world.accounts.admin.id), 'en')).toBeNull()
  })
})
