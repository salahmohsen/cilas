import type { Course } from '@/payload-types'

type Registration =
  | (Omit<Partial<NonNullable<Course['registration']>>, 'method'> & { method?: string | null })
  | null
  | undefined
export const courseRegistrationMode = (registration: Registration) =>
  registration?.mode ?? 'follow_cycle'
export const isPublishing = (
  data: { _status?: string | null; review?: { status?: string | null } | null } | null | undefined,
) => data?._status === 'published' || data?.review?.status === 'approved'
export const validateCourseMethod = (registration: Registration): true | string =>
  courseRegistrationMode(registration) !== 'own' ||
  registration?.method === 'form' ||
  registration?.method === 'external' ||
  'Choose a registration method.'

export const courseDestinationError = (registration: Registration) => {
  const method = validateCourseMethod(registration)
  if (method !== true) return { path: 'registration.method', message: method }
  if (courseRegistrationMode(registration) !== 'own') return null
  if (registration?.method === 'form' && !registration.form)
    return { path: 'registration.form', message: 'Choose a registration form.' }
  if (registration?.method === 'external' && !registration.url)
    return { path: 'registration.url', message: 'Enter the external registration URL.' }
  return null
}
