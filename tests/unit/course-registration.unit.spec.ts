import { expect, it } from 'vitest'
import {
  courseRegistrationMode,
  courseDestinationError,
  isPublishing,
} from '@/lib/course-registration'
it('defaults missing modes and validates only own destinations', () => {
  expect(courseRegistrationMode(null)).toBe('follow_cycle')
  expect(courseDestinationError({ mode: 'follow_cycle' })).toBeNull()
  expect(courseDestinationError({ mode: 'closed' })).toBeNull()
  expect(courseDestinationError({ mode: 'own' })?.path).toBe('registration.method')
  expect(courseDestinationError({ mode: 'own', method: 'form' })?.path).toBe('registration.form')
  expect(courseDestinationError({ mode: 'own', method: 'external' })?.path).toBe('registration.url')
  expect(courseDestinationError({ mode: 'own', method: 'form', form: 42 })).toBeNull()
  expect(
    courseDestinationError({ mode: 'own', method: 'external', url: 'https://example.com' }),
  ).toBeNull()
})
it('requires publish checks for direct publication and approval', () => {
  expect(isPublishing({ _status: 'published' })).toBe(true)
  expect(isPublishing({ _status: 'draft', review: { status: 'approved' } })).toBe(true)
  expect(isPublishing({ _status: 'draft', review: { status: 'submitted' } })).toBe(false)
})
