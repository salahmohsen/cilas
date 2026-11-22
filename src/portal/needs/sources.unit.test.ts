import { describe, expect, it } from 'vitest'

import { ADMIN_LIST_KEYS } from '@/lib/review-candidates'
import { KEY_WHERE, STATUS_KEYS, waitsOn } from '@/lib/review-status'
import type { User } from '@/payload-types'

import { workKeys } from '../lists/groups'
import { listKindOf } from '../lists/rows'
import { KIND_OF_KEY, OWNER_SET_KEYS, SOURCES_OF, VERB_OF, type NeedSource } from './sources'

const waitingKeys = (side: 'owner' | 'admin') => STATUS_KEYS.filter((key) => waitsOn(key) === side)

const user = (roles: string[], person: number | null) =>
  ({ id: 1, roles, person }) as unknown as User

const ROLES: Array<{ name: string; user: User; sources: NeedSource[] }> = [
  { name: 'an admin', user: user(['admin'], null), sources: ['reviewQueue', 'applicants'] },
  {
    name: 'a fellow with a person',
    user: user(['fellow'], 7),
    sources: ['ownArticles', 'ownCourses'],
  },
  { name: 'a student with a person', user: user(['member'], 7), sources: ['ownArticles'] },
  { name: 'a member with no person', user: user(['member'], null), sources: [] },
  { name: 'a user with no role', user: user([], 7), sources: [] },
]

describe('SOURCES_OF', () => {
  it.each(ROLES)('is $sources for $name', ({ user, sources }) => {
    expect(SOURCES_OF(user)).toEqual(sources)
  })
})

describe('the need kinds', () => {
  const all = (['owner', 'admin'] as const).flatMap((side) =>
    waitingKeys(side).map((key) => [side, key] as const),
  )

  it('every waiting key has a need kind and a KEY_WHERE row', () => {
    expect(all.length).toBeGreaterThan(0)
    for (const [, key] of all) {
      expect(KIND_OF_KEY[key], key).toBeDefined()
      expect(KEY_WHERE[key], key).toBeDefined()
    }
  })

  it('no key that waits on nobody has a need kind', () => {
    for (const key of STATUS_KEYS.filter((k) => waitsOn(k) === null))
      expect(KIND_OF_KEY[key], key).toBeUndefined()
  })

  it('every need kind has a verb', () => {
    for (const kind of Object.values(KIND_OF_KEY)) expect(VERB_OF[kind!]).toMatch(/^needs\./)
  })
})

describe('OWNER_SET_KEYS', () => {
  it('has a KEY_WHERE row for every key, holds every owner-waiting key, and is inside the owner lists', () => {
    for (const key of OWNER_SET_KEYS) expect(KEY_WHERE[key], key).toBeDefined()
    expect(OWNER_SET_KEYS).toEqual(expect.arrayContaining(waitingKeys('owner')))
    for (const kind of ['ownerArticles', 'fellowCourses'] as const)
      for (const key of OWNER_SET_KEYS) expect(workKeys(kind), `${kind} ${key}`).toContain(key)
  })
})

describe('ADMIN_LIST_KEYS', () => {
  it('has a KEY_WHERE row for every key', () => {
    for (const key of ADMIN_LIST_KEYS) expect(KEY_WHERE[key], key).toBeDefined()
  })

  it("is the 1b admin list's work keys", () => {
    expect([...ADMIN_LIST_KEYS]).toEqual([...workKeys('admin')])
  })
})

describe('each owner source has a 1b owner list', () => {
  it.each(ROLES.filter(({ sources }) => sources.length > 0 && !sources.includes('reviewQueue')))(
    '$name',
    ({ user }) => {
      for (const source of SOURCES_OF(user)) {
        const collection = source === 'ownArticles' ? 'articles' : 'courses'
        const kind = listKindOf(user, collection)
        expect(kind).toBe(collection === 'articles' ? 'ownerArticles' : 'fellowCourses')
      }
    },
  )
})
