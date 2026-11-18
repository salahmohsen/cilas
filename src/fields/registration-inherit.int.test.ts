import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
let place: number
const { track, cleanup } = createTracker()

const cycleWith = async (registration: Record<string, unknown>, year: number) =>
  track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: year, place, start_date: `${year}-10-04`, registration },
      overrideAccess: true,
    }),
  )

const publishFollowing = (cycle: number) =>
  payload.create({
    collection: 'courses',
    data: {
      title: 'Inherit probe',
      slug: uniq(`inherit-${Math.random().toString(36).slice(2, 6)}`),
      course_type: 'THEMATIC',
      tier: 'public',
      cycle,
      registration: { mode: 'follow_cycle' },
      _status: 'published',
    },
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Inherit place', slug: uniq('inherit-place'), city: uniq('Probe') },
      overrideAccess: true,
    }),
  ).id
})

afterAll(async () => {
  await cleanup(payload)
})

describe('a course that follows its cycle publishes with the cycle destination', () => {
  it('accepts a cycle with a site form', async () => {
    const form = await payload.create({
      collection: 'forms',
      data: {
        title: uniq('Inherit form'),
        confirmationType: 'redirect',
        redirect: { url: 'https://example.org/thanks' },
      },
    })
    track('forms', form)
    const cycle = await cycleWith({ method: 'form', form: form.id }, 2038)
    const course = track('courses', await publishFollowing(cycle.id))
    expect(course._status).toBe('published')
  })

  it('rejects a cycle whose external URL is not an http address', async () => {
    const cycle = await cycleWith({ method: 'closed' }, 2039)
    await payload.db.updateOne({
      collection: 'cycles',
      id: cycle.id,
      data: { registration: { method: 'external', url: 'javascript:alert(1)' } },
      returning: false,
    })
    await expect(publishFollowing(cycle.id)).rejects.toThrow(/registration\.url/)
  })
})
