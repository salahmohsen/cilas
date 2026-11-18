import { expect, it } from 'vitest'
import { resolveApplicationTarget } from '@/forms/application-target'
import type { Course, Cycle, Programme } from '@/payload-types'
const cycle = { id: 10, registration: { method: 'form', form: 20 } } as Cycle
it('resolves cycle form and submission destination', () => {
  expect(resolveApplicationTarget({ kind: 'cycles', target: cycle })).toMatchObject({
    kind: 'cycles',
    cycle,
    formId: 20,
    published: true,
    open: true,
    own: false,
    submitTarget: { relationTo: 'cycles', value: 10 },
  })
})
it('resolves inherited and own course forms with the supplied cycle', () => {
  const course = { id: 1, _status: 'published', registration: { mode: 'follow_cycle' } } as Course
  expect(resolveApplicationTarget({ kind: 'courses', target: course }, cycle)).toMatchObject({
    cycle,
    formId: 20,
    own: false,
    submitTarget: { relationTo: 'cycles', value: 10 },
  })
  course.registration = { mode: 'own', method: 'form', form: 30 }
  expect(resolveApplicationTarget({ kind: 'courses', target: course }, cycle)).toMatchObject({
    formId: 30,
    own: true,
    submitTarget: { relationTo: 'courses', value: 1 },
  })
  course.registration = { mode: 'closed' }
  expect(resolveApplicationTarget({ kind: 'courses', target: course }, cycle)).toMatchObject({
    formId: null,
    open: false,
  })
})
it('resolves a programme without a cycle and retains publication status', () => {
  const target = {
    id: 3,
    _status: 'draft',
    registration: { method: 'form', form: 40 },
  } as Programme
  expect(resolveApplicationTarget({ kind: 'programmes', target })).toMatchObject({
    cycle: null,
    formId: 40,
    published: false,
    submitTarget: { relationTo: 'programmes', value: 3 },
  })
})
