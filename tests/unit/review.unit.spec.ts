import { describe, expect, it } from 'vitest'

import { canMove, notifyOn, reviewEmail, reviewPatch } from '@/lib/review'

const now = new Date('2026-10-10T12:00:00.000Z')

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

  it('lets an admin make any move', () => {
    expect(canMove('draft', 'approved', true)).toBe(true)
    expect(canMove('approved', 'rejected', true)).toBe(true)
  })
})

describe('reviewPatch', () => {
  it('refuses a move the author may not make', () => {
    expect(
      reviewPatch({ from: 'submitted', to: 'approved', trusted: false, data: {}, now }),
    ).toEqual({ error: 'Only an admin can move a submitted article to approved.' })
  })

  it('keeps every unapproved article a draft', () => {
    expect(reviewPatch({ from: 'draft', to: 'submitted', trusted: false, data: {}, now })).toEqual({
      patch: { _status: 'draft' },
    })
    expect(
      reviewPatch({ from: 'approved', to: 'changes_requested', trusted: true, data: {}, now }),
    ).toEqual({ patch: { _status: 'draft' } })
  })

  it('publishes on approval at the requested tier, dated now', () => {
    expect(
      reviewPatch({
        from: 'submitted',
        to: 'approved',
        trusted: true,
        data: { tier: 'owner', requested_tier: 'public' },
        now,
      }),
    ).toEqual({
      patch: { _status: 'published', tier: 'public', published_date: '2026-10-10T12:00:00.000Z' },
    })
  })

  it("keeps an admin's lower tier and an existing date", () => {
    expect(
      reviewPatch({
        from: 'submitted',
        to: 'approved',
        trusted: true,
        data: { tier: 'community', requested_tier: 'public', published_date: '2018-01-01' },
        now,
      }),
    ).toEqual({ patch: { _status: 'published', tier: 'community', published_date: '2018-01-01' } })
  })

  it('defaults to community when no tier was requested', () => {
    expect(
      reviewPatch({ from: 'draft', to: 'approved', trusted: true, data: {}, now }),
    ).toMatchObject({ patch: { tier: 'community' } })
  })

  it('leaves an already approved article alone', () => {
    expect(
      reviewPatch({ from: 'approved', to: 'approved', trusted: true, data: {}, now }),
    ).toEqual({ patch: {} })
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

describe('reviewEmail', () => {
  it('names the article and includes the note', () => {
    expect(reviewEmail('changes_requested', 'On Ignorance', 'Shorten the intro.')).toEqual({
      subject: 'Changes requested: On Ignorance',
      text: '"On Ignorance" needs changes before it can be published.\n\nNote from the editor:\nShorten the intro.',
    })
  })

  it('includes the note on a rejection', () => {
    expect(reviewEmail('rejected', 'On Ignorance', 'Out of scope.').text).toContain(
      'Note from the editor:\nOut of scope.',
    )
  })

  it.each(['submitted', 'approved'] as const)('leaves a stale note out of a %s email', (state) => {
    expect(reviewEmail(state, 'On Ignorance', 'Shorten the intro.').text).not.toContain(
      'Shorten the intro.',
    )
  })

  it('leaves the note out when there is none', () => {
    expect(reviewEmail('submitted', 'On Ignorance', null)).toEqual({
      subject: 'Submitted for review: On Ignorance',
      text: '"On Ignorance" was submitted for review.',
    })
  })
})
