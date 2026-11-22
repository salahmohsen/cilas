import { describe, expect, expectTypeOf, it } from 'vitest'

import type { BadgeProps } from '@/components/arc/badge/badge'

import { REVIEW_STATES, type ReviewRequest, type ReviewState } from './review'
import { REVIEWED_FIELDS } from './reviewed-fields'
import {
  ADMIN_VISIBLE,
  KEY_SELECT,
  KEY_WHERE,
  KEYS_READ_ERROR,
  LIVE_COPY,
  LIVE_MAIN,
  NOT_LIVE,
  STATUS_KEYS,
  type StatusKey,
  hasUnsentEdits,
  neverPublished,
  nextAction,
  type StatusTone,
  statusBadge,
  statusInputOf,
  statusOf,
  statusSelect,
  waitsOn,
} from './review-status'

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

  it('compares Date values by time', () => {
    const at = (iso: string) => ({ published_date: new Date(iso) })
    const fields = ['published_date']
    expect(hasUnsentEdits(doc(at('2026-01-01')), doc(at('2026-02-01')), fields)).toBe(true)
    expect(hasUnsentEdits(doc(at('2026-01-01')), doc(at('2026-01-01')), fields)).toBe(false)
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

  it('is true for a main row with no _status, which is not live', () => {
    expect(neverPublished(doc({ _status: null, review: { status: 'draft' } }))).toBe(true)
  })
})

describe('statusSelect', () => {
  it.each(['articles', 'courses', 'publications'] as const)(
    'statusSelect(%s) is KEY_SELECT plus each reviewed field',
    (collection) => {
      expect(statusSelect(collection)).toEqual({
        ...KEY_SELECT,
        ...Object.fromEntries(REVIEWED_FIELDS[collection].map((field) => [field, true])),
      })
    },
  )
})

describe('statusInputOf', () => {
  it('treats a main row with no _status as not live and takes the latest version', () => {
    const main = doc({ _status: null, review: { status: 'draft' } })
    const latest = { ...copy('submitted'), title: { en: 'Newest' } }
    const input = statusInputOf({ collection: 'articles', main, latest, read: 'full' })
    expect(input).toEqual({ collection: 'articles', doc: latest, draft: null, read: 'full' })
  })

  it('takes the latest version for a document never published', () => {
    const main = notLive('draft')
    const latest = { ...copy('submitted'), title: { en: 'Newest' } }
    const input = statusInputOf({ collection: 'articles', main, latest, read: 'full' })
    expect(input).toEqual({ collection: 'articles', doc: latest, draft: null, read: 'full' })
  })

  it('takes the main row for a never-published document with no version', () => {
    const main = notLive('draft')
    const input = statusInputOf({ collection: 'articles', main, latest: null, read: 'keys' })
    expect(input).toEqual({ collection: 'articles', doc: main, draft: null, read: 'keys' })
  })

  it('takes the main row and the draft copy for a live document', () => {
    const main = live()
    const latest = copy('approved', null, 'New')
    const input = statusInputOf({ collection: 'articles', main, latest, read: 'full' })
    expect(input).toEqual({ collection: 'articles', doc: main, draft: latest, read: 'full' })
  })

  it('ignores a latest version that is the published one', () => {
    const main = live()
    const latest = doc({ title: { en: 'Live' } })
    const input = statusInputOf({ collection: 'articles', main, latest, read: 'full' })
    expect(input.draft).toBeNull()
    expect(input.doc).toBe(main)
  })
})

describe('statusOf on rows read with keys only', () => {
  const keys = (row: ReturnType<typeof doc>, draft: ReturnType<typeof doc>) => () =>
    statusOf({ collection: 'articles', doc: row, draft, read: 'keys' }, () => undefined)

  it('throws on a draft copy at approved', () => {
    expect(keys(live(), copy('approved', null, 'New'))).toThrow(KEYS_READ_ERROR)
  })

  it('reads the same rows with full reads', () => {
    expect(read(live(), copy('approved', null, 'New'))).toBe('published_unsent')
  })

  it('reads a copy at submitted with keys only, because it needs no compare', () => {
    expect(keys(live(), copy('submitted', 'changes'))()).toBe('published_edits')
  })
})

describe('KEY_WHERE', () => {
  it('every key that waits on someone has a KEY_WHERE row', () => {
    const waiting = STATUS_KEYS.filter((key) => waitsOn(key) !== null)
    expect(waiting.filter((key) => !KEY_WHERE[key])).toEqual([])
  })

  it('every row is built from NOT_LIVE or LIVE_COPY', () => {
    Object.values(KEY_WHERE).forEach((row) => {
      const first = row.where.and?.[0]
      expect(first).toBe(row.on === 'main' ? NOT_LIVE : LIVE_COPY)
    })
  })

  it('holds no parent path, which joins the parent read access for an owner', () => {
    expect(JSON.stringify(LIVE_COPY)).not.toContain('parent')
    Object.values(KEY_WHERE).forEach((row) =>
      expect(JSON.stringify(row.where)).not.toContain('parent'),
    )
  })

  it('reads a missing _status as not live, because SQL drops nulls from not_equals', () => {
    expect(NOT_LIVE).toEqual({
      or: [{ _status: { equals: 'draft' } }, { _status: { exists: false } }],
    })
  })

  it('has a row for draft that reads approved and a missing status as draft', () => {
    expect(JSON.stringify(KEY_WHERE.draft?.where)).toContain('approved')
    expect(JSON.stringify(KEY_WHERE.draft?.where)).toContain('exists')
  })
})

describe('ADMIN_VISIBLE', () => {
  const [published, states] = ADMIN_VISIBLE.or ?? []

  it('shows every live row', () => {
    expect(published).toBe(LIVE_MAIN)
  })

  it('shows a not-live row only at a state that waits on someone or was declined', () => {
    const shown = (states?.['review.status'] as { in: ReviewState[] }).in
    expect([...shown].sort()).toEqual(
      REVIEW_STATES.filter((state) => state !== 'draft' && state !== 'approved').sort(),
    )
  })

  it('names no owner, so a caller adds the reader own rows', () => {
    expect(ADMIN_VISIBLE.or).toHaveLength(2)
    expect(JSON.stringify(ADMIN_VISIBLE)).not.toContain('authors')
    expect(JSON.stringify(ADMIN_VISIBLE)).not.toContain('fellows')
  })
})

const PUBLISHED = { tone: 'success', icon: 'globe', labelKey: 'status.published' } as const

describe('statusBadge', () => {
  it.each([
    ['draft', [{ tone: 'neutral', icon: 'pencil-line', labelKey: 'status.draft' }]],
    ['submitted', [{ tone: 'info', icon: 'clock', labelKey: 'status.submitted' }]],
    [
      'changes_requested',
      [{ tone: 'warning', icon: 'message-square-warning', labelKey: 'status.changesRequested' }],
    ],
    ['rejected', [{ tone: 'danger', icon: 'circle-x', labelKey: 'status.declined' }]],
    ['published', [PUBLISHED]],
    [
      'published_unsent',
      [PUBLISHED, { tone: 'neutral', icon: 'file-pen', labelKey: 'status.unsentEdits' }],
    ],
    [
      'published_edits',
      [PUBLISHED, { tone: 'info', icon: 'file-clock', labelKey: 'status.editsInReview' }],
    ],
    [
      'published_removal',
      [PUBLISHED, { tone: 'neutral', icon: 'archive-x', labelKey: 'status.removalRequested' }],
    ],
    [
      'published_edits_returned',
      [
        PUBLISHED,
        { tone: 'warning', icon: 'message-square-warning', labelKey: 'status.changesRequested' },
      ],
    ],
    [
      'published_edits_declined',
      [PUBLISHED, { tone: 'danger', icon: 'circle-x', labelKey: 'status.editsDeclined' }],
    ],
    [
      'published_removal_kept',
      [PUBLISHED, { tone: 'neutral', icon: 'archive-restore', labelKey: 'status.keptOnSite' }],
    ],
  ] as const)('statusBadge(%s) gives %j', (key, badges) => {
    expect(statusBadge(key)).toEqual(badges)
  })

  it('every badge has an icon', () => {
    STATUS_KEYS.forEach((key) =>
      statusBadge(key).forEach((badge) => expect(badge.icon).toBeTruthy()),
    )
  })

  it('only published keys use the success tone', () => {
    STATUS_KEYS.forEach((key) => {
      const successes = statusBadge(key).filter((badge) => badge.tone === 'success')
      expect(successes).toHaveLength(key.startsWith('published') ? 1 : 0)
    })
  })

  it('Arc Badge accepts every status tone', () => {
    expectTypeOf<StatusTone>().toExtend<BadgeProps['tone']>()
  })
})

describe('nextAction', () => {
  it.each([
    ['draft', 'next.owner.draft'],
    ['submitted', 'next.owner.submitted'],
    ['changes_requested', 'next.owner.changesRequested'],
    ['rejected', 'next.owner.rejected'],
    ['published', 'next.owner.published'],
    ['published_unsent', 'next.owner.publishedUnsent'],
    ['published_edits', 'next.owner.publishedEdits'],
    ['published_removal', 'next.owner.publishedRemoval'],
    ['published_edits_returned', 'next.owner.publishedEditsReturned'],
    ['published_edits_declined', 'next.owner.publishedEditsDeclined'],
    ['published_removal_kept', 'next.owner.publishedRemovalKept'],
  ] as const)('nextAction(%s, owner) is %s', (key, labelKey) => {
    expect(nextAction(key, 'owner')).toEqual({ labelKey })
  })

  it.each([
    ['draft', null],
    ['submitted', 'next.admin.submitted'],
    ['changes_requested', 'next.admin.changesRequested'],
    ['rejected', null],
    ['published', null],
    ['published_unsent', null],
    ['published_edits', 'next.admin.publishedEdits'],
    ['published_removal', 'next.admin.publishedRemoval'],
    ['published_edits_returned', 'next.admin.publishedEditsReturned'],
    ['published_edits_declined', null],
    ['published_removal_kept', null],
  ] as const)('nextAction(%s, admin) is %s', (key, labelKey) => {
    expect(nextAction(key, 'admin')).toEqual(labelKey ? { labelKey } : null)
  })
})
