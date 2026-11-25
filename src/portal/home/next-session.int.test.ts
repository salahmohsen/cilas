import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'

import { createTracker } from '../../../testing/payload.fixture'
import { calendarWorld, type CalendarWorld } from '../../../testing/portal-calendar.fixture'
import { nextSession } from './next-session'

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
    expect(await nextSession(payload, user, 'en')).toMatchObject({ date: '2034-10-05' })
  })

  it('links a reader who has the room to the room', async () => {
    const user = await userOf(world.accounts.student.id)
    const meeting = await nextSession(payload, user, 'en')
    expect([world.course.path, world.otherCourse.path]).toContain(meeting?.href)
  })

  it('returns null without a course', async () => {
    expect(await nextSession(payload, await userOf(world.accounts.admin.id), 'en')).toBeNull()
  })
})
