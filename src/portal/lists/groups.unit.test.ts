import { describe, expect, it } from 'vitest'

import { STATUS_KEYS, waitsOn, type StatusKey } from '@/lib/review-status'

import {
  chipGroup,
  clampPage,
  GROUPS,
  groupOf,
  MAX_PAGES,
  MAX_SEARCH_CHARS,
  MAX_SEARCH_PARENTS,
  MAX_SEARCH_WORDS,
  MIN_SEARCH_CHARS,
  PAGE_SIZE,
  PAGED,
  searchTermOf,
  workKeys,
  type Chip,
  type GroupId,
  type ListKind,
} from './groups'

const kinds: ListKind[] = ['ownerArticles', 'fellowCourses', 'admin']

const expected: Record<ListKind, Record<StatusKey, GroupId>> = {
  ownerArticles: {
    draft: 'inProgress',
    submitted: 'withEditors',
    changes_requested: 'needsYou',
    rejected: 'closed',
    published: 'published',
    published_unsent: 'inProgress',
    published_edits: 'withEditors',
    published_removal: 'withEditors',
    published_edits_returned: 'needsYou',
    published_edits_declined: 'inProgress',
    published_removal_kept: 'published',
  },
  fellowCourses: {
    draft: 'proposals',
    submitted: 'proposals',
    changes_requested: 'needsYou',
    rejected: 'closed',
    published: 'teachingNow',
    published_unsent: 'teachingNow',
    published_edits: 'teachingNow',
    published_removal: 'teachingNow',
    published_edits_returned: 'needsYou',
    published_edits_declined: 'teachingNow',
    published_removal_kept: 'teachingNow',
  },
  admin: {
    draft: 'inProgress',
    submitted: 'needsYou',
    changes_requested: 'waitingOnAuthor',
    rejected: 'closed',
    published: 'published',
    published_unsent: 'published',
    published_edits: 'needsYou',
    published_removal: 'needsYou',
    published_edits_returned: 'waitingOnAuthor',
    published_edits_declined: 'published',
    published_removal_kept: 'published',
  },
}

const cases = kinds.flatMap((kind) =>
  STATUS_KEYS.map((key) => [key, kind, expected[kind][key]] as const),
)

describe('groupOf', () => {
  it.each(cases)('groupOf(%s, %s) is %s', (key, kind, group) => {
    expect(groupOf(key, kind, { hasSpace: false })).toBe(group)
  })

  it("a fellow's draft course with a space is teaching now", () => {
    expect(groupOf('draft', 'fellowCourses', { hasSpace: true })).toBe('teachingNow')
  })

  it('a declined course with a space is teaching now, not closed', () => {
    expect(groupOf('rejected', 'fellowCourses', { hasSpace: true })).toBe('teachingNow')
  })

  it('a course that waits on the teacher stays in Needs you with a space', () => {
    expect(groupOf('changes_requested', 'fellowCourses', { hasSpace: true })).toBe('needsYou')
  })

  it.each(kinds)('a space changes nothing for %s unless it is fellowCourses', (kind) => {
    if (kind === 'fellowCourses') return
    STATUS_KEYS.forEach((key) => {
      expect(groupOf(key, kind, { hasSpace: true })).toBe(groupOf(key, kind, { hasSpace: false }))
    })
  })

  it.each(kinds)('every key lands in a group of the %s list', (kind) => {
    STATUS_KEYS.forEach((key) => {
      expect(GROUPS[kind]).toContain(groupOf(key, kind, { hasSpace: false }))
      expect(GROUPS[kind]).toContain(groupOf(key, kind, { hasSpace: true }))
    })
  })

  it.each(kinds)('Needs you holds exactly the keys that wait on the reader (%s)', (kind) => {
    const reader = kind === 'admin' ? 'admin' : 'owner'
    STATUS_KEYS.forEach((key) => {
      expect(groupOf(key, kind, { hasSpace: false }) === 'needsYou').toBe(waitsOn(key) === reader)
    })
  })
})

describe('GROUPS', () => {
  it('lists the groups in the spec order', () => {
    expect(GROUPS).toEqual({
      ownerArticles: ['needsYou', 'inProgress', 'withEditors', 'published', 'closed'],
      fellowCourses: ['needsYou', 'teachingNow', 'proposals', 'closed'],
      admin: ['needsYou', 'waitingOnAuthor', 'inProgress', 'published', 'closed'],
    })
  })

  it('has no group twice in a kind', () => {
    kinds.forEach((kind) => expect(new Set(GROUPS[kind]).size).toBe(GROUPS[kind].length))
  })
})

describe('paging', () => {
  it('only Published, Teaching now and Closed page', () => {
    expect([...PAGED].sort()).toEqual(['closed', 'published', 'teachingNow'])
  })

  it('a page holds 50 rows and a list at most 20 pages', () => {
    expect([PAGE_SIZE, MAX_PAGES]).toEqual([50, 20])
  })
})

describe('workKeys', () => {
  it('owner articles load these keys in full', () => {
    expect(workKeys('ownerArticles')).toEqual([
      'draft',
      'submitted',
      'changes_requested',
      'published_unsent',
      'published_edits',
      'published_removal',
      'published_edits_returned',
      'published_edits_declined',
    ])
  })

  it('fellow courses load these keys in full', () => {
    expect(workKeys('fellowCourses')).toEqual([
      'draft',
      'submitted',
      'changes_requested',
      'published_edits_returned',
    ])
  })

  it('the admin list loads these keys in full', () => {
    expect(workKeys('admin')).toEqual([
      'draft',
      'submitted',
      'changes_requested',
      'published_edits',
      'published_removal',
      'published_edits_returned',
    ])
  })

  it.each(kinds)('only work groups load in full (%s)', (kind) => {
    workKeys(kind).forEach((key) => {
      expect(PAGED.has(groupOf(key, kind, { hasSpace: false }))).toBe(false)
    })
  })
})

describe('chipGroup', () => {
  const chips: Chip[] = ['needsYou', 'drafts', 'published']

  it.each(kinds)('each chip names a group of the %s list', (kind) => {
    chips.forEach((chip) => expect(GROUPS[kind]).toContain(chipGroup[kind][chip]))
  })

  it('Drafts is In progress, and Proposals on the fellow courses list', () => {
    expect(chipGroup.ownerArticles.drafts).toBe('inProgress')
    expect(chipGroup.admin.drafts).toBe('inProgress')
    expect(chipGroup.fellowCourses.drafts).toBe('proposals')
  })

  it('Published is Published, and Teaching now on the fellow courses list', () => {
    expect(chipGroup.ownerArticles.published).toBe('published')
    expect(chipGroup.admin.published).toBe('published')
    expect(chipGroup.fellowCourses.published).toBe('teachingNow')
  })
})

describe('clampPage', () => {
  it.each([
    [undefined, 1],
    [1, 1],
    [7, 7],
    [0, 1],
    [-1, 1],
    [-0.5, 1],
    [Number.NaN, 1],
    [2.9, 2],
    [MAX_PAGES, MAX_PAGES],
    [999, MAX_PAGES],
    [Number.POSITIVE_INFINITY, MAX_PAGES],
    [Number.NEGATIVE_INFINITY, 1],
  ])('page %s reads as %s', (page, expected) => {
    expect(clampPage(page)).toBe(expected)
  })
})

describe('searchTermOf', () => {
  it('has the limits the plan names', () => {
    expect([MAX_SEARCH_CHARS, MAX_SEARCH_WORDS, MIN_SEARCH_CHARS, MAX_SEARCH_PARENTS]).toEqual([
      100, 5, 2, 500,
    ])
  })

  it.each([null, '', '   ', 'a', ' a ', '\n\t'])('%j is no search', (term) => {
    expect(searchTermOf(term)).toBeNull()
  })

  it('trims and joins the words with one space', () => {
    expect(searchTermOf('  water \t  wheel ')).toBe('water wheel')
    expect(searchTermOf('ab')).toBe('ab')
  })

  it('keeps five words and drops the rest', () => {
    expect(searchTermOf('one two three four five six seven')).toBe('one two three four five')
  })

  it('keeps 100 characters and drops the rest', () => {
    const term = searchTermOf('x'.repeat(250))
    expect(term).toBe('x'.repeat(MAX_SEARCH_CHARS))
  })

  it('counts a word of another script as characters, not bytes', () => {
    expect(searchTermOf('عنوان')).toBe('عنوان')
    expect(searchTermOf('ع')).toBeNull()
  })
})
