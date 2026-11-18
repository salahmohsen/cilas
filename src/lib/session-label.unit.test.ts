import { describe, expect, it } from 'vitest'

import { sessionAnchor, sessionCaption, sessionTitleOf } from '@/lib/session-label'

describe('session labels', () => {
  it('names a session by its title, or by its unit when the title is empty', () => {
    expect(sessionTitleOf('What is intelligence?', 'Session 1')).toBe('What is intelligence?')
    expect(sessionTitleOf('', 'Session 1')).toBe('Session 1')
    expect(sessionTitleOf('   ', 'Session 1')).toBe('Session 1')
    expect(sessionTitleOf(null, 'Session 1')).toBe('Session 1')
    expect(sessionTitleOf(undefined, 'Session 1')).toBe('Session 1')
  })

  it('writes the caption as the unit, a dot and the title in isolates', () => {
    expect(sessionCaption('Session 1', ' What is intelligence? ')).toBe(
      'Session 1 · ⁨What is intelligence?⁩',
    )
    expect(sessionCaption('الجلسة ١', 'Turing, "Computing" (1950)')).toBe(
      'الجلسة ١ · ⁨Turing, "Computing" (1950)⁩',
    )
  })

  it('keeps the unit alone with no title, and never repeats it', () => {
    expect(sessionCaption('Session 1', undefined)).toBe('Session 1')
    expect(sessionCaption('Session 1', '')).toBe('Session 1')
    expect(sessionCaption('Session 1', '  ')).toBe('Session 1')
  })

  it('gives a session one anchor, the same in every language', () => {
    expect(sessionAnchor(1668)).toBe('session-1668')
    expect(sessionAnchor('1668')).toBe('session-1668')
  })
})
