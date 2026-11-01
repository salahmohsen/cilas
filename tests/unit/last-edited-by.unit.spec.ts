import { describe, expect, it } from 'vitest'

import { stampLastEditor } from '@/fields/last-edited-by'

const run = (data: Record<string, unknown>, user: unknown) =>
  stampLastEditor({ data, req: { user } } as never)

describe('stampLastEditor', () => {
  it('records the signed-in account on a save', () => {
    expect(run({ title: 'A' }, { id: 7, collection: 'users' })).toEqual({
      title: 'A',
      last_edited_by: 7,
    })
  })

  it('leaves the earlier editor when nobody is signed in', () => {
    expect(run({ title: 'A', last_edited_by: 3 }, null)).toEqual({ title: 'A', last_edited_by: 3 })
  })

  it('ignores a caller that is not an account', () => {
    expect(run({ title: 'A' }, { id: 1, collection: 'api-keys' })).toEqual({ title: 'A' })
  })
})
