import { describe, expect, it } from 'vitest'

import { posterLayouts } from '@/lib/posters'

describe('posterLayouts', () => {
  it('never puts the same layout side by side, around the loop too', () => {
    for (let n = 1; n <= 12; n++) {
      for (let run = 0; run < 50; run++) {
        const l = posterLayouts(n)
        expect(l).toHaveLength(n)
        l.forEach((x, i) => {
          expect([0, 1, 2, 3]).toContain(x)
          if (i > 0) expect(x).not.toBe(l[i - 1])
        })
        if (n > 2) expect(l[n - 1]).not.toBe(l[0])
      }
    }
  })
})
