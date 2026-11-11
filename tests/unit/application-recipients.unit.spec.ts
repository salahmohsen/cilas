import { describe, expect, it } from 'vitest'

import { fellowNoticesFor } from '@/forms/application-recipients'

const a = { id: 1, title: 'A', fellowUsers: [10, 11, 10] }
const b = { id: 2, title: 'B', fellowUsers: [11, 12] }

describe('fellowNoticesFor', () => {
  it('lists each course with its own fellows, once per course', () => {
    expect(fellowNoticesFor([], [a, b])).toEqual([
      { course: a, users: [10, 11] },
      { course: b, users: [11, 12] },
    ])
  })

  it('leaves out admins, who already get the full note', () => {
    expect(fellowNoticesFor([11], [a, b])).toEqual([
      { course: a, users: [10] },
      { course: b, users: [12] },
    ])
  })

  it('skips a course whose fellows are all admins or absent', () => {
    expect(fellowNoticesFor([10, 11], [a, { id: 3, title: 'C', fellowUsers: [] }])).toEqual([])
  })
})
