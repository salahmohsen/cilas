import type { Payload, PayloadRequest } from 'payload'

import { cairoDay } from '@/lib/cairo-day'

export const REGISTRATION_METHODS = ['form', 'external', 'closed'] as const
export type RegistrationMethod = (typeof REGISTRATION_METHODS)[number]

export type Registration = {
  method?: RegistrationMethod | null
  url?: string | null
  deadline?: string | null
}

export type RegistrationStatus = 'open' | 'closed'

/**
 * Whether people can register now. Each field falls back to the parent
 * (a course's cycle) when the item leaves it empty. The deadline day stays
 * open until midnight in Cairo.
 */
export const registrationStatus = (
  own: Registration | null | undefined,
  parent?: Registration | null,
  now: Date = new Date(),
): RegistrationStatus => {
  const method = own?.method ?? parent?.method
  if (!method || method === 'closed') return 'closed'

  const deadline = cairoDay(own?.deadline ?? parent?.deadline ?? '')
  const today = cairoDay(now)
  // An unset or invalid deadline never closes registration.
  if (!deadline || !today) return 'open'
  return today <= deadline ? 'open' : 'closed'
}

/**
 * What a submission applies to, with its cycle (a course without its own
 * registration uses its cycle's) and whether it is open for applications now.
 * Null when the target does not exist.
 */
export const loadApplicationTarget = async (
  payload: Payload,
  relationTo: 'programmes' | 'courses',
  id: number,
  req?: PayloadRequest,
) => {
  const target = await payload
    .findByID({ collection: relationTo, id, depth: 1, overrideAccess: true, req })
    .catch(() => null)
  if (!target) return null
  const cycle = 'cycle' in target && typeof target.cycle === 'object' ? target.cycle : null
  const open = registrationStatus(target.registration, cycle?.registration) === 'open'
  return { target, cycle, open }
}
