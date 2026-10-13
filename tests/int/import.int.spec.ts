// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { assertResetAllowed } from '../../seed/seed.utils'

let payload: Payload
const created: number[] = []

describe('archive import foundations', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of created) {
      await payload.delete({ collection: 'spaces', id, overrideAccess: true }).catch(() => undefined)
    }
    await payload.destroy()
  })

  it('refuses a second document with the same legacy URL', async () => {
    const first = await payload.create({
      collection: 'spaces',
      data: { name: 'Legacy Probe', slug: 'legacy-probe', legacy_url: '/probe.html#a' },
      overrideAccess: true,
    })
    created.push(first.id)
    await expect(
      payload.create({
        collection: 'spaces',
        data: { name: 'Legacy Probe 2', slug: 'legacy-probe-2', legacy_url: '/probe.html#a' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('refuses to reset a database that holds courses, unless asked to wipe', async () => {
    const { totalDocs } = await payload.count({ collection: 'courses', overrideAccess: true })
    if (totalDocs) await expect(assertResetAllowed(payload)).rejects.toThrow(/--wipe/)
    else await expect(assertResetAllowed(payload)).resolves.toBeUndefined()

    process.argv.push('--wipe')
    try {
      await expect(assertResetAllowed(payload)).resolves.toBeUndefined()
    } finally {
      process.argv.pop()
    }
  })
})
