import { cairoDay } from '@/lib/cairo-day'

export const REGISTRATION_METHODS = ['form', 'external', 'closed'] as const
export type RegistrationMethod = (typeof REGISTRATION_METHODS)[number]

export type Registration = {
  method?: RegistrationMethod | null
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

  const deadline = own?.deadline ?? parent?.deadline
  if (!deadline) return 'open'
  return cairoDay(now) <= cairoDay(deadline) ? 'open' : 'closed'
}
