import { describe, expect, it } from 'vitest'

import { hasUnsentEdits } from './review-status'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  _status: 'published' as const,
  ...overrides,
})

describe('hasUnsentEdits', () => {
  const fields = ['title', 'body', 'authors']

  it('ignores Lexical node ids and array row ids', () => {
    const live = {
      body: { root: { id: 'a', children: [{ id: 'b', text: 'x' }] } },
      authors: [{ id: 'row1', person: 4 }],
    }
    const copy = {
      body: { root: { id: 'z', children: [{ id: 'y', text: 'x' }] } },
      authors: [{ id: 'row2', person: 4 }],
    }
    expect(hasUnsentEdits(doc(copy), doc(live), fields)).toBe(false)
  })

  it('sees a change in one locale only', () => {
    const live = { title: { en: 'Same', ar: 'نفسه' } }
    const copy = { title: { en: 'Same', ar: 'تغير' } }
    expect(hasUnsentEdits(doc(copy), doc(live), fields)).toBe(true)
  })

  it('a missing locale equals a null locale', () => {
    const live = { title: { en: 'x' } }
    const copy = { title: { en: 'x', ar: null } }
    expect(hasUnsentEdits(doc(copy), doc(live), fields)).toBe(false)
  })

  it('sees a fellow added', () => {
    const live = { authors: [3] }
    const copy = { authors: [3, 4] }
    expect(hasUnsentEdits(doc(copy), doc(live), fields)).toBe(true)
  })

  it('is false for equal fields with different updatedAt', () => {
    const live = { title: { en: 'x' }, updatedAt: '2026-01-01T00:00:00.000Z' }
    const copy = { title: { en: 'x' }, updatedAt: '2026-01-02T00:00:00.000Z' }
    expect(hasUnsentEdits(doc(copy), doc(live), fields)).toBe(false)
  })

  it('reads only the listed fields', () => {
    expect(
      hasUnsentEdits(doc({ title: 'a', slug: 'x' }), doc({ title: 'a', slug: 'y' }), fields),
    ).toBe(false)
  })
})
