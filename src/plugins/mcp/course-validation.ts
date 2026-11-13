import { courseDestinationError } from '@/lib/course-registration'
import { validateContributionOptions } from '@/lib/pricing'
import type { z } from 'zod/v3'
import { meetingProblem } from '@/fields/meetings'
import { httpUrl } from '@/fields/validators'
import { ToolInputError } from './errors'

type Data = z.infer<z.ZodObject<z.ZodRawShape>>
const validate = (value: true | string, path: string) => {
  if (value !== true) throw new ToolInputError(`${path}: ${value}`)
}

export function validateCourse(input: Data) {
  for (const [i, session] of ((input.syllabus ?? []) as Data[]).entries())
    for (const [j, meeting] of ((session.meetings ?? []) as Data[]).entries())
      for (const field of ['date', 'start_time', 'end_time'] as const)
        validate(meetingProblem(field, meeting), `syllabus[${i}].meetings[${j}].${field}`)
  validate(validateContributionOptions(input.pricing_override?.options), 'pricing_override.options')
  const own = input.registration?.mode === 'own'
  const destinationError = courseDestinationError(input.registration)
  if (destinationError)
    throw new ToolInputError(`${destinationError.path}: ${destinationError.message}`)
  if (own && input.registration?.method === 'external' && input.registration?.url)
    validate(httpUrl(input.registration.url), 'registration.url')
}
