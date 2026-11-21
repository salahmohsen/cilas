import { describe, expect, it } from 'vitest'

import type { ReviewRequest, ReviewState } from './review'
import { type StatusKey, hasUnsentEdits, neverPublished, statusOf, waitsOn } from './review-status'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  _status: 'published' as const,
  ...overrides,
})

const live = (title = 'Live') => doc({ title: { en: title } })

const copy = (status: ReviewState | null, request: ReviewRequest | null = null, title = 'Live') =>
  doc({
    _status: 'draft' as const,
    title: { en: title },
    review: { status, request },
  })

const notLive = (status: ReviewState | null, request: ReviewRequest | null = null) =>
  doc({ _status: 'draft' as const, review: { status, request } })

const read = (row: ReturnType<typeof doc>, draft: ReturnType<typeof doc> | null = null) =>
  statusOf({ collection: 'articles', doc: row, draft, read: 'full' }, () => undefined)

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

describe('statusOf', () => {
  it.each([
    ['draft', 'draft'],
    ['submitted', 'submitted'],
    ['changes_requested', 'changes_requested'],
    ['rejected', 'rejected'],
  ] as const)('a row that is not live at %s reads %s', (status, key) => {
    expect(read(notLive(status))).toBe(key)
  })

  it.each([
    ['no copy', live(), null, 'published'],
    ['a copy at approved that differs', live(), copy('approved', null, 'New'), 'published_unsent'],
    ['a copy at approved that equals', live(), copy('approved'), 'published'],
    ['a copy at draft that differs', live(), copy('draft', null, 'New'), 'published_unsent'],
    ['a copy at draft that equals', live(), copy('draft'), 'published'],
    [
      'a copy submitted for changes',
      live(),
      copy('submitted', 'changes', 'New'),
      'published_edits',
    ],
    ['a copy submitted with no request', live(), copy('submitted', null, 'New'), 'published_edits'],
    ['a copy submitted for removal', live(), copy('submitted', 'removal'), 'published_removal'],
    [
      'a copy with changes requested',
      live(),
      copy('changes_requested', 'changes', 'New'),
      'published_edits_returned',
    ],
    [
      'a copy rejected for changes',
      live(),
      copy('rejected', 'changes', 'New'),
      'published_edits_declined',
    ],
    [
      'a copy rejected with no request',
      live(),
      copy('rejected', null, 'New'),
      'published_edits_declined',
    ],
    [
      'a changed copy rejected for removal',
      live(),
      copy('rejected', 'removal', 'New'),
      'published_unsent',
    ],
    [
      'an equal copy rejected for removal',
      live(),
      copy('rejected', 'removal'),
      'published_removal_kept',
    ],
  ] as const)('a live row with %s reads %s', (_facts, row, draft, key) => {
    expect(read(row, draft)).toBe(key)
  })

  it('an unknown combination reads draft and warns with the id', () => {
    const messages: string[] = []
    const key = statusOf(
      {
        collection: 'articles',
        doc: { ...notLive('approved'), id: 77 },
        draft: null,
        read: 'full',
      },
      (message) => messages.push(message),
    )
    expect(key).toBe('draft')
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('77')
  })

  it.each([[null], [{ status: null }]])(
    'a not-live row with review %j reads draft and does not warn',
    (review) => {
      const messages: string[] = []
      const key = statusOf(
        {
          collection: 'courses',
          doc: doc({ _status: 'draft' as const, review }),
          draft: null,
          read: 'full',
        },
        (message) => messages.push(message),
      )
      expect(key).toBe('draft')
      expect(messages).toEqual([])
    },
  )

  it('a live row whose copy has no review.status reads as a draft copy and does not warn', () => {
    const messages: string[] = []
    const warn = (message: string) => messages.push(message)
    const changed = statusOf(
      { collection: 'articles', doc: live(), draft: copy(null, null, 'New'), read: 'full' },
      warn,
    )
    const equal = statusOf(
      { collection: 'articles', doc: live(), draft: copy(null), read: 'full' },
      warn,
    )
    expect([changed, equal]).toEqual(['published_unsent', 'published'])
    expect(messages).toEqual([])
  })
})

describe('waitsOn', () => {
  it('names admin for the keys that wait on an admin', () => {
    const keys: StatusKey[] = ['submitted', 'published_edits', 'published_removal']
    expect(keys.map(waitsOn)).toEqual(['admin', 'admin', 'admin'])
  })

  it('names owner for the keys that wait on the author', () => {
    const keys: StatusKey[] = ['changes_requested', 'published_edits_returned']
    expect(keys.map(waitsOn)).toEqual(['owner', 'owner'])
  })

  it('names nobody for the rest', () => {
    const keys: StatusKey[] = [
      'draft',
      'rejected',
      'published',
      'published_unsent',
      'published_edits_declined',
      'published_removal_kept',
    ]
    expect(keys.map(waitsOn)).toEqual(keys.map(() => null))
  })
})

describe('neverPublished', () => {
  it('is true for a draft main row, also after a removal', () => {
    expect(neverPublished(notLive('draft'))).toBe(true)
    expect(neverPublished(doc({ _status: 'draft' as const, review: { status: 'draft' } }))).toBe(
      true,
    )
  })

  it('is false for a published main row', () => {
    expect(neverPublished(live())).toBe(false)
  })
})
