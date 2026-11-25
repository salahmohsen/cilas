import { describe, expect, it } from 'vitest'

import { aiButtonsOn } from '@/lib/ai-buttons'

describe('aiButtonsOn', () => {
  it('shows the buttons while no switch was ever set', () => {
    for (const unset of [undefined, null, {}, { ai_buttons: null }, { ai_buttons: true }]) {
      expect(aiButtonsOn(unset)).toBe(true)
      expect(aiButtonsOn(unset, unset)).toBe(true)
    }
  })

  it('hides them everywhere when the site switch is off, whatever the space says', () => {
    expect(aiButtonsOn({ ai_buttons: false })).toBe(false)
    expect(aiButtonsOn({ ai_buttons: false }, { ai_buttons: true })).toBe(false)
  })

  it('hides them in one space only when that space switch is off', () => {
    expect(aiButtonsOn({ ai_buttons: true }, { ai_buttons: false })).toBe(false)
    expect(aiButtonsOn({ ai_buttons: true }, { ai_buttons: true })).toBe(true)
    expect(aiButtonsOn({ ai_buttons: true })).toBe(true)
  })
})
