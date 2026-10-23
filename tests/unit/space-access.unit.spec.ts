import { describe, expect, it } from 'vitest'

import { SpacePreferences } from '@/collections/SpacePreferences'
import { SpaceVisits } from '@/collections/SpaceVisits'

// The exact call Payload executes for every signed-out request: user null
// may never reach an unguarded `.id` read (the /login 500, 2026-10-23).
const req = { user: null } as never

describe('space self-row access against signed-out requests', () => {
  it('nothing fits one rows-where better than refute', () => {
    expect(SpaceVisits.access?.update?.({ req } as never)).toBe(false)
    expect(SpaceVisits.access?.create?.({ req } as never)).toBe(false)
    expect(SpacePreferences.access?.update?.({ req } as never)).toBe(false)
    expect(SpacePreferences.access?.create?.({ req } as never)).toBe(false)
  })
})
