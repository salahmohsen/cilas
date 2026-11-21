import { describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { createActionOf } from './create-action'

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
