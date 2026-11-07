// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { cairoDay } from '@/lib/cairo-day'
import type { User } from '@/payload-types'

import { RUN, createTracker, uniq } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()
// The cycle slug comes from the city, so a unique city keeps the cycle unique.
const CITY = `Probeville ${RUN}`

describe('time, place and teaching', () => {
  let cycleId: number
  let courseId: number
  let personId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Probe Place', slug: uniq('probe-place'), city: CITY },
        overrideAccess: true,
      }),
    )
    cycleId = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'spring', start_year: 2031, place: place.id, start_date: '2031-03-04' },
        overrideAccess: true,
      }),
    ).id
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Enrollment Probe', slug: uniq('enrollment-probe') },
        overrideAccess: true,
      }),
    ).id
    courseId = track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Probe Course',
          slug: uniq('probe-course'),
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'owner',
          cycle: cycleId,
          // 4 March 2031 is a Tuesday.
          schedule: {
            start_date: '2031-03-04',
            weeks: 3,
            slots: [{ weekday: 'tue', start_time: '18:00', end_time: '20:00' }],
          },
          sessions: [{ order: 1 }, { order: 2 }, { order: 3 }],
        },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('builds the cycle title, slug and academic year from its place', async () => {
    const cycle = await payload.findByID({
      collection: 'cycles',
      id: cycleId,
      overrideAccess: true,
    })
    expect(cycle.title).toBe(`Spring 2031, ${CITY}`)
    expect(cycle.slug).toBe(`spring-2031-${uniq('probeville')}`)
    expect(cycle.academic_year).toBe('2030–2031')
  })

  it("lists the cycle's courses through the join", async () => {
    const cycle = await payload.findByID({
      collection: 'cycles',
      id: cycleId,
      overrideAccess: true,
    })
    expect(cycle.courses?.docs?.map((c) => (typeof c === 'object' ? c.id : c))).toContain(courseId)
  })

  it('computes the end date and keeps it through a partial update', async () => {
    const read = () =>
      payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, draft: true })
    expect(cairoDay((await read()).schedule?.end_date ?? '')).toBe('2031-03-18')

    await payload.update({
      collection: 'courses',
      id: courseId,
      data: { title: 'Probe Course, renamed' },
      overrideAccess: true,
    })
    expect(cairoDay((await read()).schedule?.end_date ?? '')).toBe('2031-03-18')
  })

  it('ends earlier when the last session is cancelled', async () => {
    await payload.update({
      collection: 'courses',
      id: courseId,
      data: { sessions: [{ order: 1 }, { order: 2 }, { order: 3, cancelled: true }] },
      overrideAccess: true,
    })
    const course = await payload.findByID({
      collection: 'courses',
      id: courseId,
      overrideAccess: true,
      draft: true,
    })
    expect(cairoDay(course.schedule?.end_date ?? '')).toBe('2031-03-11')
  })

  it('refuses a second enrollment for the same person and course', async () => {
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { person: personId, course: courseId, status: 'applied', source: 'admin' },
        overrideAccess: true,
      }),
    )
    await expect(
      payload.create({
        collection: 'enrollments',
        data: { person: personId, course: courseId, status: 'applied', source: 'admin' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it("shows an account only its own person's enrollments", async () => {
    const own = { id: -1, roles: ['member'], person: personId } as unknown as User
    const other = { id: -2, roles: ['member'], person: personId + 1_000_000 } as unknown as User

    const mine = await payload.find({ collection: 'enrollments', user: own, overrideAccess: false })
    const theirs = await payload.find({
      collection: 'enrollments',
      user: other,
      overrideAccess: false,
    })
    expect(mine.totalDocs).toBe(1)
    expect(theirs.totalDocs).toBe(0)
  })

  it('hides a draft programme from the public', async () => {
    const draft = track(
      'programmes',
      await payload.create({
        collection: 'programmes',
        data: {
          kind: 'bridge',
          title: 'Probe Draft Programme',
          slug: uniq('probe-draft-programme'),
        },
        draft: true,
        overrideAccess: true,
      }),
    )
    const { docs } = await payload.find({
      collection: 'programmes',
      where: { id: { equals: draft.id } },
      overrideAccess: false,
    })
    expect(docs).toHaveLength(0)
  })
})
