import { describe, expect, it } from 'vitest'

import { scratchPayload } from '../../testing/scratch-database.test-utils'

describe('review-events: migrations', () => {
  it('withdrawn is a value of enum_notifications_kind', async () => {
    const { payload, destroy } = await scratchPayload()
    try {
      const { rows } = await payload.db.pool.query<{ value: string }>(
        'select unnest(enum_range(null::enum_notifications_kind))::text as value',
      )
      expect(rows.map(({ value }) => value)).toContain('withdrawn')
    } finally {
      await destroy()
    }
  })
})
