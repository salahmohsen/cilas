import { NotFound, type Payload, type PayloadRequest } from 'payload'
import { courseRegistration, registrationStatus } from '@/lib/registration'
import { courseRegistrationMode } from '@/lib/course-registration'
import { relId } from '@/lib/relation'
import type { Course, Cycle, Programme } from '@/payload-types'

type Target =
  | { kind: 'courses'; target: Course }
  | { kind: 'cycles'; target: Cycle }
  | { kind: 'programmes'; target: Programme }

export function resolveApplicationTarget(input: Target, parent: Cycle | null = null) {
  const cycle = input.kind === 'cycles' ? input.target : parent
  const own =
    input.kind === 'courses' && courseRegistrationMode(input.target.registration) === 'own'
  const registration =
    input.kind === 'courses'
      ? courseRegistration(input.target, cycle)
      : {
          ...input.target.registration,
          formId: relId(input.target.registration?.form),
          status: registrationStatus(input.target.registration),
        }
  const submitTarget =
    input.kind === 'courses' && !own
      ? cycle
        ? { relationTo: 'cycles' as const, value: cycle.id }
        : null
      : { relationTo: input.kind, value: input.target.id }
  return {
    ...input,
    cycle,
    own,
    submitTarget,
    formId: registration.formId,
    registration,
    open: registration.status === 'open',
    published: input.kind === 'cycles' || input.target._status === 'published',
  }
}
export type ApplicationTarget = ReturnType<typeof resolveApplicationTarget>

export async function loadApplicationTarget(
  payload: Payload,
  kind: Target['kind'],
  id: number,
  req?: PayloadRequest,
) {
  const target = await payload
    .findByID({ collection: kind, id, depth: 1, overrideAccess: true, req })
    .catch((error: unknown) => {
      if (error instanceof NotFound) return null
      throw error
    })
  if (!target) return null
  return resolveApplicationTarget(
    { kind, target } as Target,
    kind === 'courses' && typeof (target as Course).cycle === 'object'
      ? ((target as Course).cycle as Cycle)
      : null,
  )
}
