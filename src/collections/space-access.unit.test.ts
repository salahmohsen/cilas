import { describe, expect, it } from 'vitest'

import { SpacePreferences } from '@/collections/SpacePreferences'
import { SpaceVisits } from '@/collections/SpaceVisits'

const req = { user: null } as never

describe('space self-row access against signed-out requests', () => {
  it('nothing fits one rows-where better than refute', () => {
    expect(SpaceVisits.access?.update?.({ req } as never)).toBe(false)
    expect(SpaceVisits.access?.create?.({ req } as never)).toBe(false)
    expect(SpacePreferences.access?.update?.({ req } as never)).toBe(false)
    expect(SpacePreferences.access?.create?.({ req } as never)).toBe(false)
  })
})
