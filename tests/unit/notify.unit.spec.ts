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
      title: 'A course waits',
      link: '/admin/x',
    })
    expect(create).toHaveBeenCalledTimes(2)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'notifications',
        data: expect.objectContaining({ recipient: 3 }),
      }),
    )
    expect(error).toHaveBeenCalledTimes(1)
  })
})
