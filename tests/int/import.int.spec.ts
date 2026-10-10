// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { assertNoReviewedContent } from '../../seed/seed.utils'

let payload: Payload
const created: number[] = []

describe('archive import foundations', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  afterAll(async () => {
    for (const id of created) {
      await payload
        .delete({ collection: 'partners', id, overrideAccess: true })
        .catch(() => undefined)
    }
    await payload.destroy()
  })

  it('refuses a second document with the same legacy URL', async () => {
    const first = await payload.create({
      collection: 'partners',
      data: {
        name: 'Legacy Probe',
        slug: 'legacy-probe',
        kind: ['other'],
        legacy_url: '/probe.html#a',
      },
      overrideAccess: true,
    })
    created.push(first.id)
    await expect(
      payload.create({
        collection: 'partners',
        data: {
          name: 'Legacy Probe 2',
          slug: 'legacy-probe-2',
          kind: ['other'],
          legacy_url: '/probe.html#a',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('lets the reset run with no reviewed content, and refuses once there is some', async () => {
    await expect(assertNoReviewedContent(payload)).resolves.toBeUndefined()

    const reviewed = await payload.create({
      collection: 'partners',
      data: {
        name: 'Reviewed Probe',
        slug: 'reviewed-probe',
        kind: ['other'],
        import_status: 'reviewed',
      },
      overrideAccess: true,
    })
    created.push(reviewed.id)
    await expect(assertNoReviewedContent(payload)).rejects.toThrow(/partners: 1/)
  })
})
