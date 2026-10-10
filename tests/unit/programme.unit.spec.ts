import { describe, expect, it } from 'vitest'

import { componentCoursesWhere } from '@/lib/programme'

describe('componentCoursesWhere', () => {
  it("selects the cycle's courses of the component's types", () => {
    expect(componentCoursesWhere({ cycle: 4, course_types: ['CORE', 'LAB'] })).toEqual({
      and: [{ cycle: { equals: 4 } }, { course_type: { in: ['CORE', 'LAB'] } }],
    })
  })

  it('accepts a populated cycle', () => {
    expect(componentCoursesWhere({ cycle: { id: 4 }, course_types: ['CORE'] })).toEqual({
      and: [{ cycle: { equals: 4 } }, { course_type: { in: ['CORE'] } }],
    })
  })

  it('is null until both cycle and types are set', () => {
    expect(componentCoursesWhere({ cycle: null, course_types: ['CORE'] })).toBeNull()
    expect(componentCoursesWhere({ cycle: 4, course_types: [] })).toBeNull()
  })
})
