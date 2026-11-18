import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { notify } from '@/lib/notify'

describe('notify', () => {
  it('leaves one notification per account, and a failure never throws', async () => {
    const create = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('db down'))
    const error = vi.fn()
    const payload = { create, logger: { error } } as unknown as Payload
    await notify(payload, [3, 3, 9], {
      kind: 'submitted',
      description: 'A course waits for review: “Test”',
      link: '/admin/x',
    })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'notifications',
        data: expect.objectContaining({
          recipient: 3,
          kind: 'submitted',
          title: 'Review requested',
          description: 'A course waits for review: “Test”',
          link: '/admin/x',
        }),
      }),
    )
    expect(error).toHaveBeenCalledTimes(1)
  })
})

describe('peoplePagesOf', () => {
  it('keeps every page on unless an admin turned it off', async () => {
    const { livePeoplePages, peoplePagesOf } = await import('@/lib/people-pages')
    const on = peoplePagesOf({ governance: false, fellows: null })
    expect(on).toEqual({ fellows: true, cilasians: true, governance: false })
    expect(livePeoplePages(on).map((p) => p.key)).toEqual(['fellows', 'cilasians'])
  })
})
