import type { Payload, PayloadRequest } from 'payload'

import { cairoDay } from '@/lib/cairo-day'
import { pricingFor } from '@/lib/pricing'
import { relId } from '@/lib/relation'
import type { Course, Cycle } from '@/payload-types'

export const REGISTRATION_METHODS = ['form', 'external', 'closed'] as const
export type RegistrationMethod = (typeof REGISTRATION_METHODS)[number]

export type Registration = {
  method?: RegistrationMethod | null
  url?: string | null
  deadline?: string | null
}

export type RegistrationStatus = 'open' | 'closed'

/** The deadline day stays open until midnight in Cairo. */
export const registrationStatus = (
  registration: Registration | null | undefined,
  now: Date = new Date(),
): RegistrationStatus => {
  const method = registration?.method
  if (!method || method === 'closed') return 'closed'
  const deadline = cairoDay(registration?.deadline ?? '')
  const today = cairoDay(now)
  if (!deadline || !today) return 'open'
  return today <= deadline ? 'open' : 'closed'
}

type RegistrationCourse = {
  course_type?: string
  registration?: Course['registration']
  pricing_override?: Course['pricing_override']
}

export const courseRegistration = (
  course: RegistrationCourse,
  cycle?: Pick<Cycle, 'registration' | 'pricing'> | null,
  now: Date = new Date(),
) => {
  const mode = course.registration?.mode ?? 'follow_cycle'
  const source = mode === 'follow_cycle' ? cycle?.registration : course.registration
  const method = mode === 'closed' ? 'closed' : (source?.method ?? null)
  const formId = mode === 'closed' ? null : (relId(source?.form) ?? null)
  const url = mode === 'closed' ? null : (source?.url ?? null)
  const sourceDeadline = cairoDay(source?.deadline ?? '')
  const closeEarly =
    mode === 'follow_cycle' ? cairoDay(course.registration?.close_early ?? '') : null
  const deadline =
    closeEarly && (!sourceDeadline || closeEarly < sourceDeadline) ? closeEarly : sourceDeadline
  return {
    status: registrationStatus({ method, deadline }, now),
    method,
    formId,
    url,
    deadline,
    price: pricingFor(
      { course_type: course.course_type ?? '', pricing_override: course.pricing_override },
      cycle,
    ),
  }
}

export const loadApplicationTarget = async (
  payload: Payload,
  relationTo: 'programmes' | 'courses' | 'cycles',
  id: number,
  req?: PayloadRequest,
) => {
  const target = await payload
    .findByID({ collection: relationTo, id, depth: 1, overrideAccess: true, req })
    .catch(() => null)
  if (!target) return null
  const cycle = 'cycle' in target && typeof target.cycle === 'object' ? target.cycle : null
  const registration = 'course_type' in target ? courseRegistration(target, cycle) : null
  const open = (registration?.status ?? registrationStatus(target.registration)) === 'open'
  const formId = registration ? registration.formId : relId(target.registration?.form)
  const published =
    relationTo === 'cycles' || ('_status' in target && target._status === 'published')
  return { target, cycle, open, published, formId }
}
