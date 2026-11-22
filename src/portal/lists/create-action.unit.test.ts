import { describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { createActionOf, headerCreateOf } from './create-action'
import { emptyStateOf } from './empty-states'

const user = (roles: User['roles'], person: number | null) =>
  ({ id: 1, roles, person }) as unknown as User

describe('createActionOf', () => {
  it.each([
    ['a linked student', user(['member'], 3)],
    ['a linked fellow', user(['fellow'], 3)],
    ['an admin with no person', user(['admin'], null)],
  ])('%s gets New article', (_name, reader) => {
    expect(createActionOf('articles', reader)).toEqual({
      labelKey: 'lists.newArticle',
      href: '/admin/collections/articles/create',
    })
  })

  it('a student with no person gets no New article', () => {
    expect(createActionOf('articles', user(['member'], null))).toBeNull()
  })

  it.each([
    ['a linked fellow', user(['fellow'], 3)],
    ['an admin with a person', user(['admin'], 3)],
  ])('%s gets Propose a course', (_name, reader) => {
    expect(createActionOf('courses', reader)).toEqual({
      labelKey: 'lists.proposeCourse',
      href: '/admin/collections/courses/create',
    })
  })

  it('an admin with no person gets no Propose a course', () => {
    expect(createActionOf('courses', user(['admin'], null))).toBeNull()
  })

  it('a student gets none on courses', () => {
    expect(createActionOf('courses', user(['member'], 3))).toBeNull()
  })
})

describe('headerCreateOf', () => {
  const owner = user(['member'], 3)
  const admin = user(['admin'], 3)
  const headerOf = (
    collection: 'articles' | 'courses',
    kind: Parameters<typeof emptyStateOf>[1],
    reader: User,
    total: number,
  ) => {
    const create = createActionOf(collection, reader)
    return headerCreateOf(create, emptyStateOf(collection, kind, create?.href ?? null), total)
  }

  it('an owner with no row sees the one primary in the empty state, not in the header', () => {
    expect(headerOf('articles', 'ownerArticles', owner, 0)).toBeNull()
    expect(headerOf('courses', 'fellowCourses', user(['fellow'], 3), 0)).toBeNull()
  })

  it('an owner with rows keeps the header button', () => {
    expect(headerOf('articles', 'ownerArticles', owner, 1)?.labelKey).toBe('lists.newArticle')
    expect(headerOf('courses', 'fellowCourses', user(['fellow'], 3), 4)?.labelKey).toBe(
      'lists.proposeCourse',
    )
  })

  it('an admin with no article keeps the header button: the empty state has none', () => {
    expect(headerOf('articles', 'admin', admin, 0)?.labelKey).toBe('lists.newArticle')
  })

  it('a reader who may not create has no header button at any total', () => {
    expect(headerOf('articles', 'ownerArticles', user(['member'], null), 0)).toBeNull()
    expect(headerOf('articles', 'ownerArticles', user(['member'], null), 5)).toBeNull()
  })
})
