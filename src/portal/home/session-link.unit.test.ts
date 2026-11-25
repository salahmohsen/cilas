import { describe, expect, it } from 'vitest'

import { sessionHref } from './session-link'

const rooms = { courses: [{ space: { course: 7 }, href: '/en/spaces/course/studio' }] }
const room = (value: unknown) => value as Parameters<typeof sessionHref>[1]

describe('sessionHref', () => {
  it('opens the room when the reader has one', () => {
    expect(sessionHref({ courseId: 7, href: '/study/studio' }, room(rooms), 'en')).toBe(
      '/en/spaces/course/studio',
    )
  })

  it('falls back to the course page on the site when the rooms could not be read', () => {
    expect(sessionHref({ courseId: 7, href: '/study/studio' }, null, 'en')).toBe('/en/study/studio')
  })

  it('falls back to the course page when the reader has no room for that course', () => {
    expect(sessionHref({ courseId: 8, href: '/study/other' }, room(rooms), 'ar')).toBe(
      '/ar/study/other',
    )
  })

  it('gives nothing to open when there is no room and no public page', () => {
    expect(sessionHref({ courseId: 8, href: null }, room(rooms), 'en')).toBeNull()
    expect(sessionHref({ courseId: 8, href: null }, null, 'en')).toBeNull()
  })
})
