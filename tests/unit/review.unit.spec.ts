import { describe, expect, it } from 'vitest'

import { canMove, notifyOn } from '@/lib/review'

describe('canMove', () => {
  it('lets an author only submit, from draft or changes requested', () => {
    expect(canMove('draft', 'submitted', false)).toBe(true)
    expect(canMove('changes_requested', 'submitted', false)).toBe(true)
    expect(canMove('submitted', 'approved', false)).toBe(false)
    expect(canMove('draft', 'approved', false)).toBe(false)
    expect(canMove('submitted', 'draft', false)).toBe(false)
  })

  it('allows staying put', () => {
    expect(canMove('submitted', 'submitted', false)).toBe(true)
  })

  it('lets an author submit a change to a published document, once decided', () => {
    expect(canMove('approved', 'submitted', false)).toBe(false)
    expect(canMove('approved', 'submitted', false, true)).toBe(true)
    expect(canMove('rejected', 'submitted', false, true)).toBe(true)
    expect(canMove('submitted', 'approved', false, true)).toBe(false)
    expect(canMove('approved', 'draft', false, true)).toBe(false)
  })

  it('lets an admin make any move', () => {
    expect(canMove('draft', 'approved', true)).toBe(true)
    expect(canMove('approved', 'rejected', true)).toBe(true)
  })
})

describe('notifyOn', () => {
  it('tells admins about a submission and authors about a decision', () => {
    expect(notifyOn('draft', 'submitted')).toBe('admins')
    expect(notifyOn('submitted', 'approved')).toBe('authors')
    expect(notifyOn('submitted', 'changes_requested')).toBe('authors')
    expect(notifyOn('submitted', 'rejected')).toBe('authors')
  })

  it('stays quiet when nothing moved or the move needs no one', () => {
    expect(notifyOn('submitted', 'submitted')).toBeNull()
    expect(notifyOn('approved', 'draft')).toBeNull()
  })
})
