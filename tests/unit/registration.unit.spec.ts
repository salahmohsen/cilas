import { describe, expect, it } from 'vitest'

import { courseRegistration, registrationStatus } from '@/lib/registration'

const lateOnDeadline = new Date('2026-03-01T21:59:59.999Z')
const midnight = new Date('2026-03-01T22:00:00Z')
const cycle = {
  registration: {
    method: 'form' as const,
    form: 7,
    url: 'https://cycle.example/apply',
    deadline: '2026-03-01',
  },
  pricing: [
    { course_types: ['THEMATIC' as const], pricing: { min: 1500, note: 'Cycle contribution' } },
  ],
}

describe('courseRegistration', () => {
  it('uses course values over cycle values, including a free price', () => {
    const resolved = courseRegistration(
      {
        course_type: 'THEMATIC',
        registration: {
          method: 'external',
          form: 9,
          url: 'https://course.example/apply',
          deadline: '2026-04-01',
        },
        pricing_override: { min: 0, note: 'Free workshop' },
      },
      cycle,
      midnight,
    )
    expect(resolved).toMatchObject({
      status: 'open',
      method: 'external',
      formId: 9,
      url: 'https://course.example/apply',
      deadline: '2026-04-01',
      price: { min: 0, note: 'Free workshop' },
    })
  })

  it('inherits each unset field and price independently', () => {
    const resolved = courseRegistration(
      {
        course_type: 'THEMATIC',
        registration: {
          method: null,
          form: null,
          url: null,
          deadline: null,
        },
        pricing_override: { min: null, note: 'Unused override' },
      },
      cycle,
      lateOnDeadline,
    )
    expect(resolved).toMatchObject({
      status: 'open',
      method: 'form',
      formId: 7,
      url: 'https://cycle.example/apply',
      deadline: '2026-03-01',
      price: { min: 1500, note: 'Cycle contribution' },
    })
    expect(
      courseRegistration({ registration: { method: 'external' } }, cycle, lateOnDeadline),
    ).toMatchObject({ method: 'external', formId: 7, deadline: '2026-03-01' })
  })

  it('stays open through the deadline day until Cairo midnight', () => {
    expect(courseRegistration({}, cycle, lateOnDeadline).status).toBe('open')
    expect(courseRegistration({}, cycle, midnight).status).toBe('closed')
  })

  it('normalizes a timestamp to its Cairo calendar day', () => {
    const course = { registration: { deadline: '2026-02-28T22:00:00.000Z' } }
    expect(courseRegistration(course, cycle, lateOnDeadline)).toMatchObject({
      deadline: '2026-03-01',
      status: 'open',
    })
    expect(courseRegistration(course, cycle, midnight).status).toBe('closed')
  })

  it('lets a course close while its cycle is open', () => {
    expect(
      courseRegistration({ registration: { method: 'closed' } }, cycle, lateOnDeadline),
    ).toMatchObject({ status: 'closed', method: 'closed', formId: 7 })
  })

  it('uses the cycle external link when the course has none', () => {
    expect(
      courseRegistration(
        {},
        { registration: { method: 'external', url: 'https://cycle.example' } },
      ),
    ).toMatchObject({ method: 'external', url: 'https://cycle.example' })
  })

  it('resolves a populated form to its id', () => {
    const form = { id: 12 } as NonNullable<
      NonNullable<Parameters<typeof courseRegistration>[0]['registration']>['form']
    >
    expect(courseRegistration({ registration: { method: 'form', form } }).formId).toBe(12)
  })
})

describe('registrationStatus', () => {
  it('is open with a method and no deadline', () => {
    expect(registrationStatus({ method: 'form' }, midnight)).toBe('open')
  })

  it('is closed with no method or an explicitly closed method', () => {
    expect(registrationStatus(null)).toBe('closed')
    expect(registrationStatus({ method: 'closed', deadline: '2099-01-01' })).toBe('closed')
  })

  it('treats an invalid deadline as absent', () => {
    expect(registrationStatus({ method: 'form', deadline: 'nope' }, midnight)).toBe('open')
  })
})
