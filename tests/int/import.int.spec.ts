// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { assertResetAllowed } from '../../seed/seed.utils'
import { RUN, createTracker, uniq, uniqPath } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()
const LEGACY_URL = `${uniqPath('probe')}.html#a`

describe('archive import foundations', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    await cleanup(payload)
    await payload.destroy()
  })

  it('refuses a second document with the same legacy URL', async () => {
    track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Legacy Probe', slug: uniq('legacy-probe'), legacy_url: LEGACY_URL },
        overrideAccess: true,
      }),
    )
    await expect(
      payload.create({
        collection: 'places',
        data: { name: 'Legacy Probe 2', slug: uniq('legacy-probe-2'), legacy_url: LEGACY_URL },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('refuses to reset a database that holds courses, unless asked to wipe', async () => {
    // Whatever else the database holds, this course makes it non-empty.
    const place = track(
      'places',
      await payload.create({
        collection: 'places',
        data: { name: 'Reset Probe', slug: uniq('reset-probe'), city: `Resetville ${RUN}` },
        overrideAccess: true,
      }),
    )
    const cycle = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2032, place: place.id },
        overrideAccess: true,
      }),
    )
    track(
      'courses',
      await payload.create({
        collection: 'courses',
        data: {
          title: 'Reset probe course',
          slug: uniq('reset-probe-course'),
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'owner',
          cycle: cycle.id,
        },
        overrideAccess: true,
      }),
    )
    await expect(assertResetAllowed(payload)).rejects.toThrow(/--wipe/)

    process.argv.push('--wipe')
    try {
      await expect(assertResetAllowed(payload)).resolves.toBeUndefined()
    } finally {
      process.argv.pop()
    }
  })
})
