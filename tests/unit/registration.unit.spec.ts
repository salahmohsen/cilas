import { describe, expect, it, vi } from 'vitest'

import { courseRegistration, registrationStatus, loadApplicationTarget } from '@/lib/registration'

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
    {
      course_types: ['THEMATIC' as const],
      pricing: { options: [{ amount: 1500, default: true }], note: 'Cycle contribution' },
    },
  ],
}

describe('courseRegistration', () => {
  it('uses course values over cycle values, including a free price', () => {
    const resolved = courseRegistration(
      {
        course_type: 'THEMATIC',
        registration: {
          mode: 'own',
          method: 'external',
          form: 9,
          url: 'https://course.example/apply',
          deadline: '2026-04-01',
        },
        pricing_override: { options: [{ amount: 0, default: true }], note: 'Free workshop' },
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
      price: { options: [{ amount: 0, default: true }], note: 'Free workshop' },
    })
  })

  it('follows the complete cycle registration and price', () => {
    const resolved = courseRegistration(
      {
        course_type: 'THEMATIC',
        registration: {
          mode: 'follow_cycle',
          method: null,
          form: null,
          url: null,
          deadline: null,
        },
        pricing_override: { options: [], note: 'Unused override' },
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
      price: { options: [{ amount: 1500, default: true }], note: 'Cycle contribution' },
    })
    expect(
      courseRegistration(
        { registration: { mode: 'own', method: 'external' } },
        cycle,
        lateOnDeadline,
      ),
    ).toMatchObject({ method: 'external', formId: null, deadline: null })
  })

  it('stays open through the deadline day until Cairo midnight', () => {
    expect(courseRegistration({}, cycle, lateOnDeadline).status).toBe('open')
    expect(courseRegistration({}, cycle, midnight).status).toBe('closed')
  })

  it('normalizes a timestamp to its Cairo calendar day', () => {
    const course = {
      registration: { mode: 'follow_cycle' as const, close_early: '2026-02-28T22:00:00.000Z' },
    }
    expect(courseRegistration(course, cycle, lateOnDeadline)).toMatchObject({
      deadline: '2026-03-01',
      status: 'open',
    })
    expect(courseRegistration(course, cycle, midnight).status).toBe('closed')
  })

  it('lets a course close while its cycle is open', () => {
    expect(
      courseRegistration({ registration: { mode: 'closed' } }, cycle, lateOnDeadline),
    ).toMatchObject({ status: 'closed', method: 'closed', formId: null })
  })

  it('uses the cycle external link when the course has none', () => {
    expect(
      courseRegistration(
        {},
        { registration: { method: 'external', url: 'https://cycle.example' } },
      ),
    ).toMatchObject({ method: 'external', url: 'https://cycle.example' })
  })

  it('closes follow_cycle when the cycle closes, and caps an open cycle with close_early', () => {
    expect(courseRegistration({}, { registration: { method: 'closed' } }).status).toBe('closed')
    const course = { registration: { mode: 'follow_cycle' as const, close_early: '2026-03-01' } }
    const laterCycle = {
      registration: { method: 'form' as const, form: 7, deadline: '2026-04-01' },
    }
    expect(courseRegistration(course, laterCycle, lateOnDeadline).status).toBe('open')
    expect(courseRegistration(course, laterCycle, midnight).status).toBe('closed')
    expect(
      courseRegistration(
        { registration: { mode: 'own', method: 'form', form: 9 } },
        cycle,
        midnight,
      ),
    ).toMatchObject({ status: 'open', formId: 9, deadline: null })
  })

  it('resolves a populated form to its id', () => {
    const form = { id: 12 } as NonNullable<
      NonNullable<Parameters<typeof courseRegistration>[0]['registration']>['form']
    >
    expect(courseRegistration({ registration: { mode: 'own', method: 'form', form } }).formId).toBe(
      12,
    )
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

it('treats only a missing application target as absent and propagates database errors', async () => {
  const { NotFound } = await import('payload')
  const findByID = vi.fn().mockRejectedValue(new NotFound())
  const payload = { findByID } as unknown as import('payload').Payload
  expect(await loadApplicationTarget(payload, 'courses', 123)).toBeNull()
  const failure = new Error('Database connection failed')
  findByID.mockRejectedValue(failure)
  await expect(loadApplicationTarget(payload, 'courses', 123)).rejects.toBe(failure)
})
