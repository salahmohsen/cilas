import { describe, expect, it } from 'vitest'

import { keyboardFit } from '@/components/arc/bottom-sheet/bottom-sheet'

const view = (height: number, offsetTop = 0, scale = 1) => ({ height, offsetTop, scale })

describe('keyboardFit', () => {
  it('is null with no keyboard, or only a browser toolbar', () => {
    expect(keyboardFit(800, view(800))).toBeNull()
    expect(keyboardFit(800, view(740))).toBeNull()
  })
  it('sits the sheet on the keyboard', () => {
    expect(keyboardFit(800, view(450))).toEqual({ height: 450, lift: 350 })
  })
  it('follows the page when Safari slides it up', () => {
    expect(keyboardFit(800, view(450, 350))).toEqual({ height: 450, lift: 0 })
    expect(keyboardFit(800, view(450, 100))).toEqual({ height: 450, lift: 250 })
  })
  it('ignores pinch zoom', () => {
    expect(keyboardFit(800, view(400, 0, 2))).toBeNull()
  })
})
