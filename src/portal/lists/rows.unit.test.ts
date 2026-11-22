import { describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { listKindOf } from './rows'

const account = (...roles: User['roles']) => ({ id: 1, roles, person: null }) as unknown as User

describe('listKindOf', () => {
  it('gives an admin the admin list of each collection', () => {
    expect(listKindOf(account('admin'), 'articles')).toBe('admin')
    expect(listKindOf(account('admin'), 'courses')).toBe('admin')
  })

  it('gives a fellow their own articles and their courses', () => {
    expect(listKindOf(account('fellow'), 'articles')).toBe('ownerArticles')
    expect(listKindOf(account('fellow'), 'courses')).toBe('fellowCourses')
  })

  it.each([['member'], ['non_degree_seeking']] as const)(
    'gives a %s their own articles and no courses list',
    (role) => {
      expect(listKindOf(account(role), 'articles')).toBe('ownerArticles')
      expect(listKindOf(account(role), 'courses')).toBeNull()
    },
  )

  it('gives an account with no role no list', () => {
    expect(listKindOf(account(), 'articles')).toBeNull()
    expect(listKindOf(account(), 'courses')).toBeNull()
  })

  it('reads an admin who is also a fellow as an admin', () => {
    expect(listKindOf(account('fellow', 'admin'), 'courses')).toBe('admin')
  })
})
